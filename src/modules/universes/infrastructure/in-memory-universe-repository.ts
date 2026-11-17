import type { Universe } from "../domain/universe";
import type { UniverseRepository } from "../domain/universe-repository";

/** Dates are mutable objects, so the repository keeps its own copies and hands out copies. */
function copyUniverse(universe: Universe): Universe {
  return {
    ...universe,
    createdAt: new Date(universe.createdAt),
    updatedAt: new Date(universe.updatedAt),
  };
}

function compareByCreationThenId(firstUniverse: Universe, secondUniverse: Universe): number {
  const creationDifference = firstUniverse.createdAt.getTime() - secondUniverse.createdAt.getTime();
  if (creationDifference !== 0) {
    return creationDifference;
  }
  return firstUniverse.id < secondUniverse.id ? -1 : firstUniverse.id > secondUniverse.id ? 1 : 0;
}

/**
 * TEMPORARY (bridge, removed with the client data layer): universes kept in memory, scoped
 * by owner. Everything is lost when the page reloads.
 */
export function createInMemoryUniverseRepository(
  startingUniverses: readonly Universe[] = [],
): UniverseRepository {
  const storedUniverses: Universe[] = startingUniverses.map(copyUniverse);

  return {
    async findAllOwnedBy(ownerId) {
      return storedUniverses
        .filter((universe) => universe.ownerId === ownerId)
        .sort(compareByCreationThenId)
        .map(copyUniverse);
    },
    async findOwnedById(ownerId, universeId) {
      const foundUniverse = storedUniverses.find(
        (universe) => universe.ownerId === ownerId && universe.id === universeId,
      );
      return foundUniverse === undefined ? null : copyUniverse(foundUniverse);
    },
    async add(universe) {
      storedUniverses.push(copyUniverse(universe));
    },
  };
}
