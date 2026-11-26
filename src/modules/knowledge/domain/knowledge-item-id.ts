import type { ValidationIssue } from "@/shared/domain/validation-error";

export const KNOWLEDGE_ITEM_ID_INVALID_CODE = "ID_INVALID";

export type KnowledgeItemIdParsing =
  | { readonly isValid: true; readonly itemId: string }
  | { readonly isValid: false; readonly issue: ValidationIssue };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/iu;

/**
 * Accepts the well-formed identifier of a work, entity or other item and returns it in lower case,
 * so the same identifier is always compared the same way. Anything else is one validation issue on
 * `field` (FR-8: a malformed identifier is a validation failure, not a not found).
 */
export function parseKnowledgeItemId(value: unknown, field: string): KnowledgeItemIdParsing {
  if (typeof value === "string" && UUID_PATTERN.test(value)) {
    return { isValid: true, itemId: value.toLowerCase() };
  }

  return { isValid: false, issue: { field, code: KNOWLEDGE_ITEM_ID_INVALID_CODE } };
}
