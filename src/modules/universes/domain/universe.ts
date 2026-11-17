import type { UniverseMode } from "./universe-mode";

/**
 * An isolated knowledge base. It always has an owner and never carries a deletion marker:
 * the repository only ever hands out universes that are not deleted. The mode never changes
 * after creation.
 */
export type Universe = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | null;
  readonly mode: UniverseMode;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
