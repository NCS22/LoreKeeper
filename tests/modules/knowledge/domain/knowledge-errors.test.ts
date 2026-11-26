import { describe, expect, it } from "vitest";
import { KnowledgeItemNotFoundError } from "@/modules/knowledge/domain/knowledge-errors";
import { NOT_FOUND_ERROR_CODE, NotFoundError } from "@/shared/domain/error-kinds";

describe("KnowledgeItemNotFoundError", () => {
  it("is a not found error with the not found code", () => {
    const error = new KnowledgeItemNotFoundError();

    expect(error).toBeInstanceOf(NotFoundError);
    expect(error.code).toBe(NOT_FOUND_ERROR_CODE);
  });

  it("always has the same fixed message with no identifier, so no case can be told apart", () => {
    expect(new KnowledgeItemNotFoundError().message).toBe("The item was not found.");
    expect(new KnowledgeItemNotFoundError().message).toBe(new KnowledgeItemNotFoundError().message);
  });
});
