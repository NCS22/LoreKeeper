import { describe, expect, it } from "vitest";
import { parseKnowledgeItemId } from "@/modules/knowledge/domain/knowledge-item-id";

const FIELD = "boundary.workId";

describe("parseKnowledgeItemId", () => {
  it("accepts a well-formed identifier", () => {
    expect(parseKnowledgeItemId("2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a", FIELD)).toEqual({
      isValid: true,
      itemId: "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a",
    });
  });

  it("returns the identifier in lower case, so it is always compared the same way", () => {
    expect(parseKnowledgeItemId("2F6C1C0E-5F0A-4C3E-8D1B-9A7E6B5C4D3A", FIELD)).toEqual({
      isValid: true,
      itemId: "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a",
    });
  });

  it.each([
    ["an empty text", ""],
    ["a text that is not an identifier", "not-a-uuid"],
    ["an identifier with spaces around", " 2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3a "],
    ["an identifier one character short", "2f6c1c0e-5f0a-4c3e-8d1b-9a7e6b5c4d3"],
    ["a number", 12],
    ["null", null],
    ["nothing", undefined],
  ])("rejects %s as a validation issue on the given field", (_description, value) => {
    expect(parseKnowledgeItemId(value, FIELD)).toEqual({
      isValid: false,
      issue: { field: FIELD, code: "ID_INVALID" },
    });
  });
});
