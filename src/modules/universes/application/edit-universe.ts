import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import { isRealUniverseChange } from "../domain/universe-change";
import { validateUniverseDescription } from "../domain/universe-description";
import { UniverseNotFoundError } from "../domain/universe-errors";
import { parseUniverseId } from "../domain/universe-id";
import { validateUniverseName } from "../domain/universe-name";
import type { UniverseRepository } from "../domain/universe-repository";
import { toUniverseDto, type UniverseDto } from "./universe-dto";

export type EditUniverseDependencies = {
  readonly universeRepository: UniverseRepository;
  readonly getCurrentTime: () => Date;
};

/**
 * Input exactly as it arrives from the form; every rule is applied by the use case. It has no
 * mode, owner or creation time: an edit can only change the name and the description.
 */
export type EditUniverseCommand = {
  readonly universeId: string;
  readonly name: string;
  readonly description: string | null;
};

/**
 * Changes the name and the description of an own universe of the acting user. The checks run in
 * this order and stop at the first failure, so no answer reveals anything about a universe of
 * another account: a malformed, empty or missing identifier is a validation error on its field;
 * a universe that is not an own one (foreign, deleted or nonexistent) is the same
 * `UniverseNotFoundError`, whatever values are sent; then both fields are checked together and
 * every failing field is reported in one `ValidationError`, storing nothing.
 * When the trimmed values are no real change from the stored ones, it answers the stored universe
 * and writes nothing, so the update time stays as it was. Otherwise it stores the trimmed values
 * with the time of the clock; the identifier, owner, mode and creation time never change.
 */
export async function editUniverse(
  dependencies: EditUniverseDependencies,
  actor: ActingUser,
  command: EditUniverseCommand,
): Promise<UniverseDto> {
  const universeIdParsing = parseUniverseId(command.universeId);
  if (!universeIdParsing.isValid) {
    throw new ValidationError([universeIdParsing.issue]);
  }

  const storedUniverse = await dependencies.universeRepository.findOwnedById(
    actor.userId,
    universeIdParsing.universeId,
  );
  if (storedUniverse === null) {
    throw new UniverseNotFoundError();
  }

  const editedFields = validateEditedFields(command);

  if (!isRealUniverseChange(storedUniverse, editedFields.name, editedFields.description)) {
    return toUniverseDto(storedUniverse);
  }

  const updatedUniverse = await dependencies.universeRepository.updateNameAndDescription(
    actor.userId,
    storedUniverse.id,
    { ...editedFields, updatedAt: dependencies.getCurrentTime() },
  );
  // The universe was deleted or changed owner between the read and the write.
  if (updatedUniverse === null) {
    throw new UniverseNotFoundError();
  }

  return toUniverseDto(updatedUniverse);
}

/** Checks both fields together and reports every failing one in a single `ValidationError`. */
function validateEditedFields(command: EditUniverseCommand): {
  readonly name: string;
  readonly description: string | null;
} {
  const nameValidation = validateUniverseName(command.name);
  const descriptionValidation = validateUniverseDescription(command.description);

  if (nameValidation.isValid && descriptionValidation.isValid) {
    return { name: nameValidation.name, description: descriptionValidation.description };
  }

  const issues: ValidationIssue[] = [];
  if (!nameValidation.isValid) {
    issues.push(nameValidation.issue);
  }
  if (!descriptionValidation.isValid) {
    issues.push(descriptionValidation.issue);
  }
  throw new ValidationError(issues);
}
