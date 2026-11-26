import type { WorkMedium } from "./work-medium";

/** The word used for the units of a work; it derives from the medium and is never chosen. */
export type UnitWording = "chapter" | "episode" | "unit";

const UNIT_WORDING_BY_MEDIUM: Readonly<Record<WorkMedium, UnitWording>> = {
  NOVEL: "chapter",
  MANGA: "chapter",
  COMIC: "chapter",
  ANIME: "episode",
  TV_SERIES: "episode",
  FILM: "unit",
  OTHER: "unit",
};

/** The unit wording of a medium (spec 006, Definitions): it is not stored, so it cannot disagree (D10). */
export function toUnitWording(medium: WorkMedium): UnitWording {
  return UNIT_WORDING_BY_MEDIUM[medium];
}
