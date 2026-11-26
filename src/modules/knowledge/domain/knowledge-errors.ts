import { NotFoundError } from "@/shared/domain/error-kinds";

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
