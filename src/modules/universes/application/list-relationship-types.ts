import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError } from "@/shared/domain/validation-error";
import type { RelationshipTypeRepository } from "../domain/relationship-type-repository";
import { UniverseNotFoundError } from "../domain/universe-errors";
import { parseUniverseId } from "../domain/universe-id";
import type { UniverseRepository } from "../domain/universe-repository";
import { toRelationshipTypeDto, type RelationshipTypeDto } from "./relationship-type-dto";

export type ListRelationshipTypesDependencies = {
  readonly universeRepository: UniverseRepository;
  readonly relationshipTypeRepository: RelationshipTypeRepository;
};

/**
 * The relationship type catalog of one own universe, ordered by key. A universe of another
 * account, a deleted one and one that does not exist give the same `UniverseNotFoundError`; a
 * malformed identifier is a validation error.
 *
 * Temporary exception of spec 006 (2026-11-25): no visibility rule is applied, the catalog is
 * structure and is listed whole; it ends with the Phase 4 spec that filters the reads of spec 006.
 */
export async function listRelationshipTypes(
  dependencies: ListRelationshipTypesDependencies,
  actor: ActingUser,
  universeId: string,
): Promise<readonly RelationshipTypeDto[]> {
  const universeIdParsing = parseUniverseId(universeId);
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

  const relationshipTypes = await dependencies.relationshipTypeRepository.findAllInOwnedUniverse(
    actor.userId,
    ownUniverse.id,
  );
  return relationshipTypes.map(toRelationshipTypeDto);
}
