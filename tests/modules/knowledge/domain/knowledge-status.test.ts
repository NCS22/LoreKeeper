import { describe, expect, it } from "vitest";
import { KNOWLEDGE_STATUSES, parseKnowledgeStatus } from "@/modules/knowledge/domain/knowledge-status";

describe("parseKnowledgeStatus", () => {
  it("knows exactly the three statuses of the spec", () => {
    expect(KNOWLEDGE_STATUSES).toEqual(["CONFIRMED", "USER_NOTE", "SPECULATION"]);
  });

  it.each(["CONFIRMED", "USER_NOTE", "SPECULATION"])("accepts %s", (status) => {
    expect(parseKnowledgeStatus(status)).toBe(status);
  });

  it.each([
    ["a lower-case value", "confirmed"],
    ["a value with spaces around", " USER_NOTE "],
    ["an unknown value", "RUMOR"],
    ["an empty text", ""],
    ["null", null],
    ["nothing (there is no default status)", undefined],
  ])("rejects %s", (_description, value) => {
    expect(parseKnowledgeStatus(value)).toBeNull();
  });
});
