import { BusinessRuleViolationError, NotFoundError } from "@/shared/domain/error-kinds";

/**
 * A universe, work, unit, entity or relationship type that does not exist, is deleted, belongs to
 * another account or to another universe. The message is fixed and carries no identifier, so these
 * cases cannot be told apart (FR-8, FR-11).
 */
export class KnowledgeItemNotFoundError extends NotFoundError {
  constructor() {
    super("The item was not found.");
  }
}

/**
 * A relationship whose source and target are the same entity (FR-8). It is checked before any
 * lookup, so it never tells whether that entity exists; the message names no entity.
 */
export class RelationshipToItselfError extends BusinessRuleViolationError {
  constructor() {
    super("A relationship cannot connect an entity with itself.");
  }
}
