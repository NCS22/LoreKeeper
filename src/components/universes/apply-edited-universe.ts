import type { UniverseDto } from "@/modules/universes";

/**
 * Puts the answer of an edit into the list, in the place of the universe with the same identifier, so the
 * position stays the creation order (FR-5). Two answers can arrive in any order, so an entry already listed
 * with a strictly later update time is kept (FR-12); a save with no real change answers the stored time and
 * is applied. A universe that is not listed is ignored. The list it was given is never changed.
 */
export function applyEditedUniverse(
  universes: readonly UniverseDto[],
  editedUniverse: UniverseDto,
): readonly UniverseDto[] {
  const listedUniverse = universes.find((universe) => universe.id === editedUniverse.id);
  if (listedUniverse === undefined || isUpdatedLater(listedUniverse, editedUniverse)) return universes;

  return universes.map((universe) => (universe.id === editedUniverse.id ? editedUniverse : universe));
}

function isUpdatedLater(listedUniverse: UniverseDto, editedUniverse: UniverseDto): boolean {
  return Date.parse(listedUniverse.updatedAt) > Date.parse(editedUniverse.updatedAt);
}
