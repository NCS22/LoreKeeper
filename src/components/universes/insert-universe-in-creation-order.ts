import type { UniverseDto } from "@/modules/universes";

/**
 * Adds a universe to the list in the order the server lists them (creation instant, then identifier,
 * both ascending, FR-11). A late answer can arrive after a later creation, so appending is not enough.
 * A universe already in the list is not added twice.
 */
export function insertUniverseInCreationOrder(
  universes: readonly UniverseDto[],
  newUniverse: UniverseDto,
): readonly UniverseDto[] {
  if (universes.some((universe) => universe.id === newUniverse.id)) return universes;

  const orderedUniverses = [...universes, newUniverse];
  orderedUniverses.sort(compareInCreationOrder);
  return orderedUniverses;
}

function compareInCreationOrder(first: UniverseDto, second: UniverseDto): number {
  const firstInstant = Date.parse(first.createdAt);
  const secondInstant = Date.parse(second.createdAt);
  if (firstInstant !== secondInstant) return firstInstant - secondInstant;
  if (first.id === second.id) return 0;
  return first.id < second.id ? -1 : 1;
}
