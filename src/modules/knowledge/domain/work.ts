import type { WorkMedium } from "./work-medium";

/** A unit of a new work, before it is stored: the storage gives it its identifier. */
export type NewNarrativeUnit = {
  readonly label: string;
  readonly ordinal: number;
};

/** A work about to be stored together with all its units, in one all-or-nothing write. */
export type NewWork = {
  readonly id: string;
  readonly universeId: string;
  readonly title: string;
  readonly medium: WorkMedium;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly units: readonly NewNarrativeUnit[];
};

/**
 * A stored work with the number of its units. The repository only hands out works that are not
 * deleted, and counts only units that are not deleted.
 */
export type Work = {
  readonly id: string;
  readonly universeId: string;
  readonly title: string;
  readonly medium: WorkMedium;
  readonly unitCount: number;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};
