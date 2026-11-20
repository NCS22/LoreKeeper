import { NotFoundError } from "@/shared/domain/error-kinds";

/**
 * The universe does not exist, is deleted or belongs to another account. The message is
 * fixed and carries no identifier, so these cases cannot be told apart (FR-35).
 */
export class UniverseNotFoundError extends NotFoundError {
  constructor() {
    super("The universe was not found.");
  }
}
