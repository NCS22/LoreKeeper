import type { Universe } from "./universe";

/**
 * Storage port for universes. There is deliberately no update or delete method: in this
 * version a universe is only created and read (spec 001, FR-18).
 */
export type UniverseRepository = {
  /** Every stored universe, in creation order (oldest first). */
  findAll(): Promise<readonly Universe[]>;
  /** Stores a new universe after the existing ones. Other universes are not changed. */
  add(universe: Universe): Promise<void>;
};
