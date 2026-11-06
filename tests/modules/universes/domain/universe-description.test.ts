import { describe, expect, it } from "vitest";
import {
  MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH,
  validateUniverseDescription,
} from "@/modules/universes/domain/universe-description";

describe("validateUniverseDescription", () => {
  it("allows a maximum of 2000 characters", () => {
    expect(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH).toBe(2000);
  });

  it.each([
    ["no description", null],
    ["an empty description", ""],
    ["a description with only whitespace", "  \n\t  "],
  ])("treats %s as no description", (_description, rawDescription) => {
    expect(validateUniverseDescription(rawDescription)).toEqual({
      isValid: true,
      description: null,
    });
  });

  it("accepts a description of exactly the maximum length", () => {
    const description = "a".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);

    expect(validateUniverseDescription(description)).toEqual({ isValid: true, description });
  });

  it("rejects a description one character over the maximum and reports the limit", () => {
    const description = "a".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH + 1);

    expect(validateUniverseDescription(description)).toEqual({
      isValid: false,
      issue: {
        field: "description",
        code: "DESCRIPTION_TOO_LONG",
        maximumLength: MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH,
      },
    });
  });

  it("measures the length after removing surrounding whitespace", () => {
    const description = "a".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);

    expect(validateUniverseDescription(`  ${description}\n `)).toEqual({
      isValid: true,
      description,
    });
  });

  it("counts an emoji as one character", () => {
    const description = "😀".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);

    expect(validateUniverseDescription(description)).toEqual({ isValid: true, description });
    expect(validateUniverseDescription(`${description}😀`)).toMatchObject({ isValid: false });
  });

  it("preserves line breaks inside the description", () => {
    expect(validateUniverseDescription("  First line\n\nSecond line\r\nThird line  ")).toEqual({
      isValid: true,
      description: "First line\n\nSecond line\r\nThird line",
    });
  });
});
