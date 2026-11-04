// DTO types mirror the API representation in .claude/rules/data-model.md. Ordinals are never
// exposed: narrative units are ordered by their position in the array they come in.

export type InformationStatusDto = "CONFIRMED" | "USER_NOTE" | "SPECULATION";

// Where a piece of information is revealed: a unit of a work, shown by its label.
export type NarrativePositionDto = {
  workId: string;
  unitId: string;
  label: string;
};
