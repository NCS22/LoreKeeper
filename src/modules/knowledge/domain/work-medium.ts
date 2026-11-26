export const WORK_MEDIUMS = ["NOVEL", "MANGA", "COMIC", "ANIME", "TV_SERIES", "FILM", "OTHER"] as const;

export type WorkMedium = (typeof WORK_MEDIUMS)[number];

export const WORK_MEDIUM_FIELD = "medium";
export const WORK_MEDIUM_INVALID_CODE = "MEDIUM_INVALID";

/** Returns the medium when the value is exactly one of the known media, otherwise `null`. */
export function parseWorkMedium(value: unknown): WorkMedium | null {
  return WORK_MEDIUMS.find((medium) => medium === value) ?? null;
}
