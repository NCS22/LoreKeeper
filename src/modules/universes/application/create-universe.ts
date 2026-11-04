import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import type { Universe } from "../domain/universe";
import { validateUniverseDescription } from "../domain/universe-description";
import { parseUniverseMode } from "../domain/universe-mode";
import { validateUniverseName } from "../domain/universe-name";
import type { UniverseRepository } from "../domain/universe-repository";
import { toUniverseDto, type UniverseDto } from "./universe-dto";

export const UNIVERSE_MODE_FIELD = "mode";
export const UNIVERSE_MODE_INVALID_CODE = "MODE_INVALID";

export type CreateUniverseDependencies = {
  readonly universeRepository: UniverseRepository;
  readonly generateUniverseId: () => string;
  readonly getCurrentTime: () => Date;
};

/** Input exactly as it arrives from the form; every rule is applied by the use case. */
export type CreateUniverseCommand = {
  readonly name: string;
  readonly description: string | null;
  readonly mode: string;
};

/**
 * Creates an empty universe. Name, description and mode are checked together and every
 * failing field is reported in one `ValidationError`; nothing is stored in that case.
 * A name already used by another universe does not block creation (FR-12).
 */
export async function createUniverse(
  dependencies: CreateUniverseDependencies,
  command: CreateUniverseCommand,
): Promise<UniverseDto> {
  const nameValidation = validateUniverseName(command.name);
  const descriptionValidation = validateUniverseDescription(command.description);
  const mode = parseUniverseMode(command.mode);

  const issues: ValidationIssue[] = [];
  if (!nameValidation.isValid) {
    issues.push(nameValidation.issue);
  }
  if (!descriptionValidation.isValid) {
    issues.push(descriptionValidation.issue);
  }
  if (mode === null) {
    issues.push({ field: UNIVERSE_MODE_FIELD, code: UNIVERSE_MODE_INVALID_CODE });
  }

  if (!nameValidation.isValid || !descriptionValidation.isValid || mode === null) {
    throw new ValidationError(issues);
  }

  const creationTime = dependencies.getCurrentTime();
  const universe: Universe = {
    id: dependencies.generateUniverseId(),
    name: nameValidation.name,
    description: descriptionValidation.description,
    mode,
    createdAt: creationTime,
    updatedAt: creationTime,
  };

  await dependencies.universeRepository.add(universe);

  return toUniverseDto(universe);
}
