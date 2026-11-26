import type { WorkMedium } from "./work-medium";

/**
 * A point of a work as the details panel shows it: the work with its title and medium (the medium
 * gives the unit wording) and the label of the unit. It describes a stored `SpoilerBoundary`.
 */
export type NarrativePoint = {
  readonly workId: string;
  readonly workTitle: string;
  readonly workMedium: WorkMedium;
  readonly unitLabel: string;
};
