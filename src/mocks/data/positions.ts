import { ANIME_WORK_ID, NARRATIVE_UNITS, NOVEL_WORK_ID, TIDEWRACK_WORK_ID, WORKS } from "@/mocks/data/works";
import type { NarrativePositionDto } from "@/mocks/dto/shared";

// Builds a position from the label the user would pick, so sample data reads like the real UI.
export function positionAt(workId: string, unitLabel: string): NarrativePositionDto {
  const unit = NARRATIVE_UNITS.find((candidate) => candidate.workId === workId && candidate.label === unitLabel);
  if (unit === undefined) {
    throw new Error(`Sample data references the unknown unit "${unitLabel}" of ${workId}`);
  }
  return { workId, unitId: unit.id, label: unit.label };
}

export const inNovel = (unitLabel: string) => positionAt(NOVEL_WORK_ID, unitLabel);
export const inAnime = (unitLabel: string) => positionAt(ANIME_WORK_ID, unitLabel);
export const inSaltLedger = (unitLabel: string) => positionAt(TIDEWRACK_WORK_ID, unitLabel);

// Orders positions by work, then by unit order. The real app does this with the hidden ordinal.
export function comparePositions(first: NarrativePositionDto, second: NarrativePositionDto): number {
  const workOrder = (workId: string) => WORKS.find((work) => work.id === workId)?.displayOrder ?? 0;
  if (first.workId !== second.workId) return workOrder(first.workId) - workOrder(second.workId);
  const unitOrder = (unitId: string) => NARRATIVE_UNITS.findIndex((unit) => unit.id === unitId);
  return unitOrder(first.unitId) - unitOrder(second.unitId);
}
