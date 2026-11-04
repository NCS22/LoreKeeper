import type { UniverseMode } from "./universe-mode";

/**
 * An isolated knowledge base. In this version it has no owner, cover image or deletion
 * marker: those are out of scope (spec 001). The mode never changes after creation.
 */
export type Universe = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly mode: UniverseMode;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
