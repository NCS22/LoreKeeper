import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import type { ValidationIssue } from "@/shared/domain/validation-error";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import { KnowledgeItemNotFoundError } from "../domain/knowledge-errors";
import { parseKnowledgeItemId } from "../domain/knowledge-item-id";
import { parseUnitNumber } from "../domain/unit-number";
import type { WorkRepository } from "../domain/work-repository";

/** A point as the forms send it: a work and the number of one of its units, typed as text (D6). */
export type BoundaryCommand = {
  readonly workId: string;
  readonly unitNumber: string;
};

/** A well-formed point, not looked up yet. A `null` unit number names no unit of any work. */
export type BoundaryReference = {
  readonly workId: string;
  readonly unitNumber: number | null;
};

export type BoundaryReading = {
  /** `null` when the point has issues. */
  readonly reference: BoundaryReference | null;
  readonly issues: readonly ValidationIssue[];
};

/**
 * Applies the format rules of a point: a well-formed work identifier and a unit number written
 * with the format of FR-1. Each issue is reported on the input path given for that field.
 */
export function readBoundary(
  boundary: BoundaryCommand,
  workIdField: string,
  unitNumberField: string,
): BoundaryReading {
  const workIdParsing = parseKnowledgeItemId(boundary.workId, workIdField);
  const unitNumberParsing = parseUnitNumber(boundary.unitNumber, unitNumberField);
  const issues: ValidationIssue[] = [];
  if (!workIdParsing.isValid) {
    issues.push(workIdParsing.issue);
  }
  if (!unitNumberParsing.isValid) {
    issues.push(unitNumberParsing.issue);
  }
  if (!workIdParsing.isValid || !unitNumberParsing.isValid) {
    return { reference: null, issues };
  }
  return { reference: { workId: workIdParsing.itemId, unitNumber: unitNumberParsing.unitNumber }, issues };
}

/**
 * Looks the point up in the universe of the context. A work that does not exist, is deleted, is of
 * another account or of another universe, and a number with no unit in that work, all give the
 * same not found (FR-8).
 */
export async function resolveBoundary(
  workRepository: WorkRepository,
  viewerContext: ViewerContext,
  reference: BoundaryReference,
): Promise<SpoilerBoundary> {
  if (reference.unitNumber === null) {
    throw new KnowledgeItemNotFoundError();
  }
  const boundary = await workRepository.findBoundaryOfUnitNumber(
    viewerContext,
    reference.workId,
    reference.unitNumber,
  );
  if (boundary === null) {
    throw new KnowledgeItemNotFoundError();
  }
  return boundary;
}
