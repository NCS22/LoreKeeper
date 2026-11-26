import type { UnitWording } from "../domain/unit-wording";
import { toUnitWording } from "../domain/unit-wording";
import type { Work } from "../domain/work";
import type { WorkMedium } from "../domain/work-medium";

/** A work as seen outside the module: no universe, no units, no ordinals. Dates are ISO 8601 in UTC. */
export type WorkDto = {
  readonly id: string;
  readonly title: string;
  readonly medium: WorkMedium;
  readonly unitWording: UnitWording;
  readonly unitCount: number;
  readonly createdAt: string;
};

export function toWorkDto(work: Work): WorkDto {
  return {
    id: work.id,
    title: work.title,
    medium: work.medium,
    unitWording: toUnitWording(work.medium),
    unitCount: work.unitCount,
    createdAt: work.createdAt.toISOString(),
  };
}
