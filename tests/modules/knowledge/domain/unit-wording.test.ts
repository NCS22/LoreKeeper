import { describe, expect, it } from "vitest";
import { toUnitWording } from "@/modules/knowledge/domain/unit-wording";

describe("toUnitWording", () => {
  it.each([
    ["NOVEL", "chapter"],
    ["MANGA", "chapter"],
    ["COMIC", "chapter"],
    ["ANIME", "episode"],
    ["TV_SERIES", "episode"],
    ["FILM", "unit"],
    ["OTHER", "unit"],
  ] as const)("words the units of a %s work as %j", (medium, unitWording) => {
    expect(toUnitWording(medium)).toBe(unitWording);
  });
});
