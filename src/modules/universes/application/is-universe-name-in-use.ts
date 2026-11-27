import type { ActingUser } from "@/shared/domain/acting-user";
import type { Universe } from "../domain/universe";
import { parseUniverseId } from "../domain/universe-id";
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
 * When `excludedUniverseId` is an own universe, that universe is left out, so a universe being
 * edited never counts as a duplicate of itself. A malformed identifier, or one of a universe of
 * another account or of none, excludes nothing and never throws, so the answer reveals nothing
 * about it.
 */
export async function isUniverseNameInUse(
  dependencies: IsUniverseNameInUseDependencies,
  actor: ActingUser,
  name: string,
  excludedUniverseId?: string,
): Promise<boolean> {
  const comparableName = toComparableUniverseName(name);
  if (comparableName.length === 0) {
    return false;
  }

  const ownUniverses = await dependencies.universeRepository.findAllOwnedBy(actor.userId);
  const comparedUniverses = leaveOutExcludedUniverse(ownUniverses, excludedUniverseId);
  return comparedUniverses.some(
    (universe) => toComparableUniverseName(universe.name) === comparableName,
  );
}

/**
 * The own universes without the one whose identifier is given. The identifier is parsed first, so
 * a missing or malformed value leaves the list as it is and is never used to filter anything.
 */
function leaveOutExcludedUniverse(
  ownUniverses: readonly Universe[],
  excludedUniverseId: string | undefined,
): readonly Universe[] {
  if (excludedUniverseId === undefined) {
    return ownUniverses;
  }

  const excludedUniverseIdParsing = parseUniverseId(excludedUniverseId);
  if (!excludedUniverseIdParsing.isValid) {
    return ownUniverses;
  }

  return ownUniverses.filter(
    (universe) => universe.id !== excludedUniverseIdParsing.universeId,
  );
}
