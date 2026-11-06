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

/** Universes kept in memory, in creation order. Everything is lost when the page reloads. */
export function createInMemoryUniverseRepository(
  startingUniverses: readonly Universe[] = [],
): UniverseRepository {
  const storedUniverses: Universe[] = startingUniverses.map(copyUniverse);

  return {
    async findAll() {
      return storedUniverses.map(copyUniverse);
    },
    async add(universe) {
      storedUniverses.push(copyUniverse(universe));
    },
  };
}
