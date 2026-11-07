import { describe, expect, it } from "vitest";
import {
  MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH,
  validateAccountDisplayName,
} from "@/modules/accounts/domain/account-display-name";

describe("validateAccountDisplayName", () => {
  it("allows a maximum of 120 characters", () => {
    expect(MAXIMUM_ACCOUNT_DISPLAY_NAME_LENGTH).toBe(120);
  });

  it.each([
    ["an empty name", ""],
    ["a name with only spaces", "     "],
    ["a name with only whitespace and line breaks", " \t\n "],
  ])("rejects %s as required", (_description, rawDisplayName) => {
    expect(validateAccountDisplayName(rawDisplayName)).toEqual({
      isValid: false,
      issue: { field: "displayName", code: "DISPLAY_NAME_REQUIRED" },
    });
  });

  it("accepts a name of exactly 120 characters", () => {
    const displayName = "a".repeat(120);

    expect(validateAccountDisplayName(displayName)).toEqual({ isValid: true, displayName });
  });

  it("rejects a name of 121 characters and reports the limit", () => {
    expect(validateAccountDisplayName("a".repeat(121))).toEqual({
      isValid: false,
      issue: { field: "displayName", code: "DISPLAY_NAME_TOO_LONG", maximumLength: 120 },
    });
  });

  it("measures the length after removing surrounding spaces", () => {
    const displayName = "a".repeat(120);

    expect(validateAccountDisplayName(`   ${displayName}   `)).toEqual({
      isValid: true,
      displayName,
    });
  });

  it("counts an emoji as one character", () => {
    const displayName = "😀".repeat(120);

    expect(validateAccountDisplayName(displayName)).toEqual({ isValid: true, displayName });
    expect(validateAccountDisplayName(`${displayName}😀`)).toMatchObject({
      isValid: false,
      issue: { code: "DISPLAY_NAME_TOO_LONG" },
    });
  });

  it("counts a compound emoji as several characters", () => {
    const family = "👨‍👩‍👧‍👦";

    expect(Array.from(family).length).toBeGreaterThan(1);
    expect(validateAccountDisplayName(family.repeat(30))).toMatchObject({
      isValid: false,
      issue: { code: "DISPLAY_NAME_TOO_LONG" },
    });
  });

  it.each([
    ["a line break inside", "Ana\nMaria"],
    ["a trailing line break", "Ana\n"],
    ["a leading carriage return", "\rAna"],
    ["a tab inside", "Ana\tMaria"],
    ["a line separator (U+2028)", "Ana Maria"],
    ["a paragraph separator (U+2029)", "Ana Maria"],
    ["a null character", "Ana\u0000"],
  ])("rejects a name with %s", (_description, rawDisplayName) => {
    expect(validateAccountDisplayName(rawDisplayName)).toEqual({
      isValid: false,
      issue: { field: "displayName", code: "DISPLAY_NAME_INVALID_CHARACTERS" },
    });
  });

  it("reports the missing name before the invalid characters", () => {
    expect(validateAccountDisplayName("\n")).toMatchObject({
      issue: { code: "DISPLAY_NAME_REQUIRED" },
    });
  });

  it("reports the invalid characters before the length", () => {
    expect(validateAccountDisplayName(`${"a".repeat(121)}\n`)).toMatchObject({
      issue: { code: "DISPLAY_NAME_INVALID_CHARACTERS" },
    });
  });

  it("removes surrounding spaces and keeps the inner ones as typed", () => {
    expect(validateAccountDisplayName("  Ana   Maria  ")).toEqual({
      isValid: true,
      displayName: "Ana   Maria",
    });
  });

  it("accepts markup as plain text", () => {
    expect(validateAccountDisplayName("<b>Ana</b> & <script>x</script>")).toEqual({
      isValid: true,
      displayName: "<b>Ana</b> & <script>x</script>",
    });
  });

  it("accepts non-Latin characters, emoji and punctuation", () => {
    expect(validateAccountDisplayName("星の旅人 😀 O'Brien-Smith.")).toEqual({
      isValid: true,
      displayName: "星の旅人 😀 O'Brien-Smith.",
    });
  });
});
