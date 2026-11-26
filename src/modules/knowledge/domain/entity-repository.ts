import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { Entity, NewEntity } from "./entity";
import type { EntityType } from "./entity-type";

/**
 * Storage port for entities and their fragments. Callers check the ownership of the universe first
 * (the read methods receive the `ViewerContext` that is built only after that check); every method
 * is limited to the one universe it is given and never reads another universe's entities.
 */
export type EntityRepository = {
  /**
   * Stores the entity together with its first fragment, if any, all or nothing: when the fragment
   * cannot be stored, the entity is not stored either. A boundary whose work is not of the entity's
   * universe, or whose unit is not of that work, is refused and nothing is stored.
   */
  add(newEntity: NewEntity): Promise<void>;
  /**
   * Every entity of the universe of the context that is not deleted, oldest first; entities created
   * at the same instant are ordered by identifier ascending.
   */
  findAllInUniverse(viewerContext: ViewerContext): Promise<readonly Entity[]>;
  /**
   * The name of the oldest entity that is not deleted, of the given type and with the given
   * comparable name, in the universe of the context; `null` when there is none (FR-6).
   */
  findOldestNameOfSimilarEntity(
    viewerContext: ViewerContext,
    entityType: EntityType,
    normalizedName: string,
  ): Promise<string | null>;
};
