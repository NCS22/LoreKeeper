import type { RelationshipType } from "./relationship-type";

/**
 * Read-only storage port for the relationship type catalog of a universe, scoped by owner. The
 * types are written only together with their universe (`UniverseRepository.add`), so there is no
 * write method here.
 */
export type RelationshipTypeRepository = {
  /**
   * The types of the universe that are not deleted, ordered by key. Empty when the universe does
   * not exist, belongs to another owner or is deleted: all three look the same.
   *
   * Temporary exception of spec 006 (2026-11-25): no visibility rule is applied, the catalog is
   * structure and is returned whole; it ends with the Phase 4 spec that filters the reads of spec 006.
   */
  findAllInOwnedUniverse(ownerId: string, universeId: string): Promise<readonly RelationshipType[]>;
};
