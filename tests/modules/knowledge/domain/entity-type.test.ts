import { describe, expect, it } from "vitest";
import { ENTITY_TYPES, parseEntityType } from "@/modules/knowledge/domain/entity-type";

describe("parseEntityType", () => {
  it("knows exactly the eight entity types of the spec, in their order", () => {
    expect(ENTITY_TYPES).toEqual([
      "CHARACTER",
      "LOCATION",
      "ORGANIZATION",
      "FACTION",
      "OBJECT",
      "ABILITY",
      "SPECIES",
      "CONCEPT",
    ]);
  });

  it.each(["CHARACTER", "LOCATION", "ORGANIZATION", "FACTION", "OBJECT", "ABILITY", "SPECIES", "CONCEPT"])(
    "accepts %s",
    (entityType) => {
      expect(parseEntityType(entityType)).toBe(entityType);
    },
  );

  it.each([
    ["a lower-case value", "character"],
    ["a value with spaces around", " CHARACTER "],
    ["an unknown value", "EVENT"],
    ["an empty text", ""],
    ["a number", 1],
    ["null", null],
    ["nothing", undefined],
  ])("rejects %s", (_description, value) => {
    expect(parseEntityType(value)).toBeNull();
  });
});
