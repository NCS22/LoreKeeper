import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError } from "@/shared/domain/validation-error";
import type { RememberedUniverseRepository } from "../domain/remembered-universe-repository";
import { UniverseNotFoundError } from "../domain/universe-errors";
import { parseUniverseId } from "../domain/universe-id";
import type { UniverseRepository } from "../domain/universe-repository";

export type RememberUniverseDependencies = {
  readonly universeRepository: UniverseRepository;
  readonly rememberedUniverseRepository: RememberedUniverseRepository;
};

export type RememberUniverseCommand = {
  readonly universeId: string;
};

/**
 * Stores one of the own universes as the remembered universe of the acting user. A malformed
 * identifier is a validation error; an identifier that is not an own universe (foreign,
 * deleted or nonexistent) is the same `UniverseNotFoundError`, and nothing is stored.
 */
export async function rememberUniverse(
  dependencies: RememberUniverseDependencies,
  actor: ActingUser,
  command: RememberUniverseCommand,
): Promise<void> {
  const universeIdParsing = parseUniverseId(command.universeId);
  if (!universeIdParsing.isValid) {
    throw new ValidationError([universeIdParsing.issue]);
  }

  const ownUniverse = await dependencies.universeRepository.findOwnedById(
    actor.userId,
    universeIdParsing.universeId,
  );
  if (ownUniverse === null) {
    throw new UniverseNotFoundError();
  }

  await dependencies.rememberedUniverseRepository.saveRememberedUniverse(
    actor.userId,
    ownUniverse.id,
  );
}
