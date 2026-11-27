import { describe, expect, it } from "vitest";
import { isRealUniverseChange } from "@/modules/universes/domain/universe-change";

const composedName = "Café del Norte";
const decomposedName = "Café del Norte";

describe("isRealUniverseChange", () => {
  it("is no change when the name and the description are the same text", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", "The world of the Rings.")).toBe(
      false,
    );
  });

  it("is no change when the name differs only in whitespace at the ends", () => {
    const storedUniverse = { name: "Middle-earth", description: null };

    expect(isRealUniverseChange(storedUniverse, "  Middle-earth \t", null)).toBe(false);
  });

  it("is no change when the description differs only in whitespace at the ends", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(
      isRealUniverseChange(storedUniverse, "Middle-earth", "\n The world of the Rings.  "),
    ).toBe(false);
  });

  it("is no change when the name is the same text composed and decomposed", () => {
    const storedUniverse = { name: composedName, description: null };

    expect(isRealUniverseChange(storedUniverse, decomposedName, null)).toBe(false);
  });

  it("is no change when the description is the same text composed and decomposed", () => {
    const storedUniverse = { name: "Middle-earth", description: decomposedName };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", composedName)).toBe(false);
  });

  it.each([
    ["case", "Middle-earth", "middle-earth"],
    ["an accent", "Cafe del Norte", composedName],
    ["inner spacing", "Middle earth", "Middle  earth"],
  ])("is a change when the name differs in %s", (_difference, storedName, editedName) => {
    const storedUniverse = { name: storedName, description: null };

    expect(isRealUniverseChange(storedUniverse, editedName, null)).toBe(true);
  });

  it.each([
    ["case", "The world of the Rings.", "the world of the Rings."],
    ["an accent", "Cafe del Norte", composedName],
    ["inner spacing", "The world of the Rings.", "The world  of the Rings."],
  ])("is a change when the description differs in %s", (_difference, storedText, editedText) => {
    const storedUniverse = { name: "Middle-earth", description: storedText };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", editedText)).toBe(true);
  });

  it("is no change when there was no description and there is still none", () => {
    const storedUniverse = { name: "Middle-earth", description: null };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", null)).toBe(false);
  });

  it.each([
    ["empty", ""],
    ["only whitespace", "  \n\t "],
  ])(
    "is no change when there was no description and the new one is %s",
    (_form, editedDescription) => {
      const storedUniverse = { name: "Middle-earth", description: null };

      expect(isRealUniverseChange(storedUniverse, "Middle-earth", editedDescription)).toBe(false);
    },
  );

  it("is a change when there was no description and a text is given", () => {
    const storedUniverse = { name: "Middle-earth", description: null };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", "The world of the Rings.")).toBe(
      true,
    );
  });

  it("is a change when the description is removed", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", null)).toBe(true);
  });

  it("is a change when the description is replaced by only whitespace, which counts as none", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", "   ")).toBe(true);
  });

  it("is a change when the description is a different text", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(isRealUniverseChange(storedUniverse, "Middle-earth", "The Second Age.")).toBe(true);
  });

  it("is a change when only the name changes and the description stays the same", () => {
    const storedUniverse = { name: "Middle-earth", description: "The world of the Rings." };

    expect(isRealUniverseChange(storedUniverse, "Arda", "The world of the Rings.")).toBe(true);
  });
});
