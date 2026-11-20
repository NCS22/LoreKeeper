import { describe, expect, it } from "vitest";
import { parseUniverseId } from "@/modules/universes/domain/universe-id";

const INVALID_ISSUE = { field: "universeId", code: "UNIVERSE_ID_INVALID" };

describe("parseUniverseId", () => {
  it("accepts a well-formed UUID", () => {
    expect(parseUniverseId("3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b")).toEqual({
      isValid: true,
      universeId: "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b",
    });
  });

  it("returns a UUID in lower case so the same identifier is always compared the same way", () => {
    expect(parseUniverseId("3F2B8C1E-5D4A-4B6F-9A7E-1C2D3E4F5A6B")).toEqual({
      isValid: true,
      universeId: "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b",
    });
  });

  it.each([
    ["an empty text", ""],
    ["a text with only spaces", "   "],
    ["a text that is not a UUID", "universe-1"],
    ["a UUID with spaces around it", " 3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b "],
    ["a UUID with a character over", "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6bx"],
    ["a UUID without hyphens", "3f2b8c1e5d4a4b6f9a7e1c2d3e4f5a6b"],
    ["a UUID with a non-hexadecimal character", "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6g"],
    ["a missing value", undefined],
    ["null", null],
    ["a number", 42],
    ["an object", { universeId: "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b" }],
  ])("rejects %s with one issue on the universeId field", (_description, value) => {
    expect(parseUniverseId(value)).toEqual({ isValid: false, issue: INVALID_ISSUE });
  });
});
