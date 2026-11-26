import { describe, expect, it } from "vitest";
import {
  isBlankFragmentContent,
  MAXIMUM_FRAGMENT_CONTENT_LENGTH,
  readFragmentContent,
} from "@/modules/knowledge/domain/fragment-content";

describe("readFragmentContent", () => {
  it("allows a maximum of 5000 characters", () => {
    expect(MAXIMUM_FRAGMENT_CONTENT_LENGTH).toBe(5000);
  });

  it.each([
    ["an empty content", ""],
    ["a content with only spaces", "     "],
    ["a content with only tabs and line breaks", " \t\n\r "],
  ])("reads %s as no fragment at all", (_description, rawContent) => {
    expect(isBlankFragmentContent(rawContent)).toBe(true);
    expect(readFragmentContent(rawContent)).toEqual({ isPresent: false });
  });

  it("accepts a content of 1 character", () => {
    expect(isBlankFragmentContent("A")).toBe(false);
    expect(readFragmentContent("A")).toEqual({ isPresent: true, isValid: true, content: "A" });
  });

  it("accepts a content of exactly 5000 characters", () => {
    const content = "a".repeat(5000);

    expect(readFragmentContent(content)).toEqual({ isPresent: true, isValid: true, content });
  });

  it("rejects a content of 5001 characters and reports the limit", () => {
    expect(readFragmentContent("a".repeat(5001))).toEqual({
      isPresent: true,
      isValid: false,
      issue: { field: "fragment.content", code: "CONTENT_TOO_LONG", maximumLength: 5000 },
    });
  });

  it("trims the content before measuring it, and keeps inner line breaks", () => {
    const content = `First line.\n\nSecond line, ${"a".repeat(4970)}`;

    expect(readFragmentContent(`  \n${content}\t `)).toEqual({ isPresent: true, isValid: true, content });
  });

  it("counts characters as code points, so 5000 emoji fit and 5001 do not", () => {
    const content = "\u{1F4DC}".repeat(5000);

    expect(readFragmentContent(content)).toEqual({ isPresent: true, isValid: true, content });
    expect(readFragmentContent(`${content}\u{1F4DC}`)).toMatchObject({
      issue: { code: "CONTENT_TOO_LONG" },
    });
  });

  it.each([
    ["a null character", "He left\u0000home"],
    ["a lone surrogate", "He left\uDC00home"],
  ])("rejects a content with %s as invalid characters", (_description, rawContent) => {
    expect(readFragmentContent(rawContent)).toEqual({
      isPresent: true,
      isValid: false,
      issue: { field: "fragment.content", code: "CONTENT_INVALID_CHARACTERS" },
    });
  });
});
