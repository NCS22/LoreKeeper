import type {
  NarrativeUnit as StoredNarrativeUnit,
  Work as StoredWork,
} from "@/shared/infrastructure/generated/prisma/client";
import type { NarrativePoint } from "../domain/narrative-point";

/** The columns of a stored boundary together with what is read of its work and its unit. */
export type StoredBoundaryWithDescription = {
  readonly boundaryWorkId: string;
  readonly boundaryWork: Pick<StoredWork, "title" | "medium">;
  readonly boundaryUnit: Pick<StoredNarrativeUnit, "label">;
};

/** What a query includes to describe the boundary of a row: the title and medium of the work and the unit label. */
export const BOUNDARY_DESCRIPTION_INCLUDE = {
  boundaryWork: { select: { title: true, medium: true } },
  boundaryUnit: { select: { label: true } },
} as const;

/**
 * Turns a stored boundary into the described point. The stored medium is the PostgreSQL enum
 * `WorkMedium`, whose values the type checker matches with the domain media.
 */
export function toNarrativePoint(storedBoundary: StoredBoundaryWithDescription): NarrativePoint {
  return {
    workId: storedBoundary.boundaryWorkId,
    workTitle: storedBoundary.boundaryWork.title,
    workMedium: storedBoundary.boundaryWork.medium,
    unitLabel: storedBoundary.boundaryUnit.label,
  };
}
