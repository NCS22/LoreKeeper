import { toComparableUniverseName } from "../domain/universe-name";
import type { UniverseRepository } from "../domain/universe-repository";

export type IsUniverseNameInUseDependencies = {
  readonly universeRepository: UniverseRepository;
};

/**
 * Tells whether another universe already has this name, ignoring case, accents and
 * surrounding or repeated whitespace. An empty or whitespace-only name is never "in use";
 * rejecting it is the job of creation, so this never throws for invalid names.
 */
export async function isUniverseNameInUse(
  dependencies: IsUniverseNameInUseDependencies,
  name: string,
): Promise<boolean> {
  const comparableName = toComparableUniverseName(name);
  if (comparableName.length === 0) {
    return false;
  }

  const universes = await dependencies.universeRepository.findAll();
  return universes.some(
    (universe) => toComparableUniverseName(universe.name) === comparableName,
  );
}
