import { describe, expect, it } from "vitest";
import { toComparableEntityName } from "@/modules/knowledge/domain/entity-comparable-name";

describe("toComparableEntityName", () => {
  it.each([
    ["letter case", "Éowyn", "ÉOWYN"],
    ["accents", "Éowyn", "Eowyn"],
    ["surrounding and repeated spacing", "Tom  Bombadil", "  tom bombadil "],
    ["composed and decomposed characters", "José", "José"],
  ])("ignores %s", (_description, firstName, secondName) => {
    expect(toComparableEntityName(firstName)).toBe(toComparableEntityName(secondName));
  });

  it("keeps different names different", () => {
    expect(toComparableEntityName("Frodo")).not.toBe(toComparableEntityName("Frado"));
  });

  it("gives the comparable form of the name of a universe", () => {
    expect(toComparableEntityName("  Ñandú   Río ")).toBe("nandu rio");
  });
});
