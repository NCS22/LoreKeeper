import type { ActingUser } from "@/shared/domain/acting-user";
import { toComparableUniverseName } from "../domain/universe-name";
import type { UniverseRepository } from "../domain/universe-repository";

export type IsUniverseNameInUseDependencies = {
  readonly universeRepository: UniverseRepository;
};

/**
 * Tells whether another universe of the acting user already has this name, ignoring case,
 * accents, composition and surrounding or repeated whitespace. Universes of other accounts
 * are never compared. An empty or whitespace-only name is never "in use"; rejecting it is
 * the job of creation, so this never throws for invalid names.
 */
export async function isUniverseNameInUse(
  dependencies: IsUniverseNameInUseDependencies,
  actor: ActingUser,
  name: string,
): Promise<boolean> {
  const comparableName = toComparableUniverseName(name);
  if (comparableName.length === 0) {
    return false;
  }

  const ownUniverses = await dependencies.universeRepository.findAllOwnedBy(actor.userId);
  return ownUniverses.some(
    (universe) => toComparableUniverseName(universe.name) === comparableName,
  );
}
