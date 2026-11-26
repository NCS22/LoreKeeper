import { describe, expect, it } from "vitest";
import { parseWorkMedium, WORK_MEDIUMS } from "@/modules/knowledge/domain/work-medium";

describe("parseWorkMedium", () => {
  it("knows exactly the seven media of the spec, in their order", () => {
    expect(WORK_MEDIUMS).toEqual(["NOVEL", "MANGA", "COMIC", "ANIME", "TV_SERIES", "FILM", "OTHER"]);
  });

  it.each(["NOVEL", "MANGA", "COMIC", "ANIME", "TV_SERIES", "FILM", "OTHER"])(
    "accepts %s",
    (medium) => {
      expect(parseWorkMedium(medium)).toBe(medium);
    },
  );

  it.each([
    ["a lower-case value", "novel"],
    ["a value with spaces around", " NOVEL "],
    ["an unknown value", "PODCAST"],
    ["an empty text", ""],
    ["a number", 3],
    ["null", null],
    ["nothing", undefined],
  ])("rejects %s", (_description, value) => {
    expect(parseWorkMedium(value)).toBeNull();
  });
});
