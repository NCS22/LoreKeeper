/**
 * The point of a work where a piece of information is revealed: a work and one of its narrative
 * units. It is stored as two columns (`boundaryWorkId`, `boundaryUnitId`) on each item that has one;
 * the database checks that the unit is of the work and the work is of the item's universe.
 */
export type SpoilerBoundary = {
  readonly workId: string;
  readonly unitId: string;
};
