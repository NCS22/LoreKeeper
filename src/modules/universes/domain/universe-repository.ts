import type { Universe } from "./universe";

/**
 * Storage port for universes, scoped by owner: no method reads or writes a universe of an
 * account other than the one it is given. There is deliberately no update or delete method
 * (spec 005).
 */
export type UniverseRepository = {
  /**
   * Every universe of the owner that is not deleted, oldest first; universes created at the
   * same instant are ordered by identifier ascending.
   */
  findAllOwnedBy(ownerId: string): Promise<readonly Universe[]>;
  /**
   * The universe, or `null` when it does not exist, belongs to another owner or is deleted:
   * all three look the same.
   */
  findOwnedById(ownerId: string, universeId: string): Promise<Universe | null>;
  /**
   * Stores a new universe together with its eight predefined relationship types, all or nothing:
   * when the types cannot be stored, the universe is not stored either. Other universes are not changed.
   */
  add(universe: Universe): Promise<void>;
};
