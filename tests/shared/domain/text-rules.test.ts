import { describe, expect, it } from "vitest";
import { countTextCharacters, isStorableText } from "@/shared/domain/text-rules";

describe("isStorableText", () => {
  it.each([
    ["plain text", "Middle-earth"],
    ["an emoji, a valid surrogate pair", "Ember 😀"],
    ["non-Latin text", "星の物語"],
    ["line breaks and tabs", "one\ntwo\tthree"],
    ["an empty text", ""],
  ])("accepts %s", (_description, text) => {
    expect(isStorableText(text)).toBe(true);
  });

  it.each([
    ["the null character", "Ember\u0000"],
    ["the null character alone", "\u0000"],
    ["a lone high surrogate", "Ember\uD800"],
    ["a lone low surrogate", "\uDC00Ember"],
    ["a high surrogate followed by a letter", "\uD800a"],
    ["two surrogates in the wrong order", "\uDC00\uD800"],
  ])("refuses %s", (_description, text) => {
    expect(isStorableText(text)).toBe(false);
  });
});

describe("countTextCharacters", () => {
  it("counts code points, so an emoji is one and a letter with a combining accent is two", () => {
    expect(countTextCharacters("abc")).toBe(3);
    expect(countTextCharacters("😀")).toBe(1);
    expect(countTextCharacters("😀".repeat(5000))).toBe(5000);
    expect(countTextCharacters("é")).toBe(2);
    expect(countTextCharacters("é")).toBe(1);
    expect(countTextCharacters("")).toBe(0);
  });

  it("counts line breaks and spaces as characters", () => {
    expect(countTextCharacters(" a\nb ")).toBe(5);
  });
});
