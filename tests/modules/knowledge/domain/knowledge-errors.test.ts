import { describe, expect, it } from "vitest";
import {
  KnowledgeItemNotFoundError,
  RelationshipToItselfError,
} from "@/modules/knowledge/domain/knowledge-errors";
import {
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
  BusinessRuleViolationError,
  NOT_FOUND_ERROR_CODE,
  NotFoundError,
} from "@/shared/domain/error-kinds";

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

describe("RelationshipToItselfError", () => {
  it("is a business rule violation with its code and a fixed message that names no entity (FR-8)", () => {
    const error = new RelationshipToItselfError();

    expect(error).toBeInstanceOf(BusinessRuleViolationError);
    expect(error).not.toBeInstanceOf(NotFoundError);
    expect(error.code).toBe(BUSINESS_RULE_VIOLATION_ERROR_CODE);
    expect(error.message).toBe("A relationship cannot connect an entity with itself.");
  });
});
