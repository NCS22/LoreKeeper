import type { Universe } from "./universe";

/**
 * What an edit may write: the new name and description, already validated, and the time of the
 * change. It has no mode, owner or creation time, so an edit can never write them (spec 007a).
 */
export type UniverseNameAndDescriptionChange = {
  readonly name: string;
  readonly description: string | null;
  readonly updatedAt: Date;
};

/**
 * Storage port for universes, scoped by owner: no method reads or writes a universe of an
 * account other than the one it is given. A universe's name and description can be updated
 * (spec 007a); there is deliberately no delete method yet (the trash of spec 007b).
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
  /**
   * Writes the name, description and update time of an own universe that is not deleted, in one
   * conditional write, and returns the universe as stored. Answers `null`, changing nothing, when
   * the universe does not exist, belongs to another owner or is deleted: all three look the same.
   */
  updateNameAndDescription(
    ownerId: string,
    universeId: string,
    change: UniverseNameAndDescriptionChange,
  ): Promise<Universe | null>;
};
