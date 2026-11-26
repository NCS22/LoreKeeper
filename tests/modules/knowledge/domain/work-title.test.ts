import { describe, expect, it } from "vitest";
import { MAXIMUM_WORK_TITLE_LENGTH, validateWorkTitle } from "@/modules/knowledge/domain/work-title";

describe("validateWorkTitle", () => {
  it("allows a maximum of 200 characters", () => {
    expect(MAXIMUM_WORK_TITLE_LENGTH).toBe(200);
  });

  it.each([
    ["an empty title", ""],
    ["a title with only spaces", "     "],
    ["a title with only tabs and line breaks", " \t\n "],
  ])("rejects %s as required", (_description, rawTitle) => {
    expect(validateWorkTitle(rawTitle)).toEqual({
      isValid: false,
      issue: { field: "title", code: "TITLE_REQUIRED" },
    });
  });

  it("accepts a title of 1 character", () => {
    expect(validateWorkTitle("A")).toEqual({ isValid: true, title: "A" });
  });

  it("accepts a title of exactly 200 characters", () => {
    const title = "a".repeat(200);

    expect(validateWorkTitle(title)).toEqual({ isValid: true, title });
  });

  it("rejects a title of 201 characters and reports the limit", () => {
    expect(validateWorkTitle("a".repeat(201))).toEqual({
      isValid: false,
      issue: { field: "title", code: "TITLE_TOO_LONG", maximumLength: 200 },
    });
  });

  it("measures the length after removing surrounding whitespace, and keeps inner spaces", () => {
    const title = `${"a".repeat(99)}  ${"b".repeat(99)}`;

    expect(validateWorkTitle(`  \t${title}\n `)).toEqual({ isValid: true, title });
  });

  it("counts characters as code points, so 200 emoji fit and 201 do not", () => {
    const title = "😀".repeat(200);

    expect(validateWorkTitle(title)).toEqual({ isValid: true, title });
    expect(validateWorkTitle(`${title}😀`)).toMatchObject({
      isValid: false,
      issue: { code: "TITLE_TOO_LONG" },
    });
  });

  it.each([
    ["a null character", "My\u0000Novel"],
    ["a lone surrogate", "My\uD800Novel"],
  ])("rejects a title with %s as invalid characters", (_description, rawTitle) => {
    expect(validateWorkTitle(rawTitle)).toEqual({
      isValid: false,
      issue: { field: "title", code: "TITLE_INVALID_CHARACTERS" },
    });
  });

  it("checks the characters before the length, so a long title with a null character is invalid, not too long", () => {
    expect(validateWorkTitle(`${"a".repeat(250)}\u0000`)).toMatchObject({
      issue: { code: "TITLE_INVALID_CHARACTERS" },
    });
  });
});
