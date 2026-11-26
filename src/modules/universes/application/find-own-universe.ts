import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError } from "@/shared/domain/validation-error";
import { parseUniverseId } from "../domain/universe-id";
import type { UniverseRepository } from "../domain/universe-repository";
import { toUniverseDto, type UniverseDto } from "./universe-dto";

export type FindOwnUniverseDependencies = {
  readonly universeRepository: UniverseRepository;
};

/**
 * One own universe of the acting user, or `null` when it is not one: a universe of another
 * account, a deleted one and one that does not exist all give `null`, so they cannot be told
 * apart. A malformed identifier is a validation error. Other modules check ownership with it.
 */
export async function findOwnUniverse(
  dependencies: FindOwnUniverseDependencies,
  actor: ActingUser,
  universeId: string,
): Promise<UniverseDto | null> {
  const universeIdParsing = parseUniverseId(universeId);
  if (!universeIdParsing.isValid) {
    throw new ValidationError([universeIdParsing.issue]);
  }

  const ownUniverse = await dependencies.universeRepository.findOwnedById(
    actor.userId,
    universeIdParsing.universeId,
  );
  return ownUniverse === null ? null : toUniverseDto(ownUniverse);
}
