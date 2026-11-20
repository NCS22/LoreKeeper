import { describe, expect, it } from "vitest";
import {
  countUniverseTextCharacters,
  isValidUniverseText,
} from "@/modules/universes/domain/universe-text";

describe("isValidUniverseText", () => {
  it.each([
    ["plain text", "Middle-earth"],
    ["an emoji, a valid surrogate pair", "Ember 😀"],
    ["non-Latin text", "星の物語"],
    ["line breaks and tabs", "one\ntwo\tthree"],
  ])("accepts %s", (_description, text) => {
    expect(isValidUniverseText(text)).toBe(true);
  });

  it.each([
    ["the null character", "Ember\u0000"],
    ["a lone high surrogate", "Ember\uD800"],
    ["a lone low surrogate", "\uDC00Ember"],
    ["a high surrogate followed by a letter", "\uD800a"],
  ])("rejects %s", (_description, text) => {
    expect(isValidUniverseText(text)).toBe(false);
  });
});

describe("countUniverseTextCharacters", () => {
  it("counts code points, so an emoji is one and a letter with a combining accent is two", () => {
    expect(countUniverseTextCharacters("abc")).toBe(3);
    expect(countUniverseTextCharacters("😀")).toBe(1);
    expect(countUniverseTextCharacters("é")).toBe(2);
    expect(countUniverseTextCharacters("")).toBe(0);
  });
});
