import type { NewNarrativeUnit } from "./work";

/** New units get ordinals with gaps, so a unit can later be inserted between two (data model). */
export const UNIT_ORDINAL_STEP = 1000;

/**
 * The units of a new work of `unitCount` units: labelled "1" to "N" in order, with ordinals
 * assigned by the system in steps of 1000. Nothing of them comes from the person (FR-1).
 */
export function buildNumberedUnits(unitCount: number): readonly NewNarrativeUnit[] {
  return Array.from({ length: unitCount }, (_unused, index) => {
    const unitNumber = index + 1;
    return { label: String(unitNumber), ordinal: unitNumber * UNIT_ORDINAL_STEP };
  });
}
