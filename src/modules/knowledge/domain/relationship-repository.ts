import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { EntityRelationship, NewRelationship } from "./relationship";

/**
 * Storage port for relationships. Callers check the ownership of the universe first (the read
 * method receives the `ViewerContext` that is built only after that check); every method is limited
 * to the one universe it is given and never reads another universe's relationships.
 */
export type RelationshipRepository = {
  /**
   * Stores one relationship. A relationship from an entity to itself, or whose source, target,
   * type or boundary work is not of its universe, or whose unit is not of that work, is refused
   * and nothing is stored (the database constraints).
   */
  add(newRelationship: NewRelationship): Promise<void>;
  /**
   * Every relationship that is not deleted, of the universe of the context, where the entity is the
   * source or the target and neither entity is deleted; oldest first, and relationships created at
   * the same instant by identifier ascending (FR-10).
   */
  findAllOfEntity(viewerContext: ViewerContext, entityId: string): Promise<readonly EntityRelationship[]>;
};
