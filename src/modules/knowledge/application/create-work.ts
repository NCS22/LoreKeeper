import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import { buildNumberedUnits } from "../domain/numbered-units";
import { parseUnitCount } from "../domain/unit-count";
import type { NewWork } from "../domain/work";
import { parseWorkMedium, WORK_MEDIUM_FIELD, WORK_MEDIUM_INVALID_CODE } from "../domain/work-medium";
import type { WorkRepository } from "../domain/work-repository";
import { validateWorkTitle } from "../domain/work-title";
import type { OwnUniverseLookup } from "./own-universe-lookup";
import { resolveViewerContext } from "./resolve-viewer-context";
import { toWorkDto, type WorkDto } from "./work-dto";

export type CreateWorkDependencies = {
  readonly ownUniverseLookup: OwnUniverseLookup;
  readonly workRepository: WorkRepository;
  readonly generateWorkId: () => string;
  readonly getCurrentTime: () => Date;
};

/**
 * Input exactly as it arrives from the form; every rule is applied by the use case. The number of
 * units travels as text, so "1e3" or "+12" reach the domain rule however they are sent.
 */
export type CreateWorkCommand = {
  readonly universeId: string;
  readonly title: string;
  readonly medium: string;
  readonly unitCount: string;
};

/**
 * Creates a work with N units labelled "1" to "N" in one own universe of the acting user (FR-1).
 * The universe is checked first: another account's, a deleted and a nonexistent universe give the
 * same not found error. Then title, medium and number of units are checked together and every
 * failing field is reported in one `ValidationError`. The work and its units are stored in one
 * all-or-nothing write; nothing of the units comes from the command.
 */
export async function createWork(
  dependencies: CreateWorkDependencies,
  actor: ActingUser,
  command: CreateWorkCommand,
): Promise<WorkDto> {
  const viewerContext = await resolveViewerContext(dependencies, actor, command.universeId);

  const titleValidation = validateWorkTitle(command.title);
  const medium = parseWorkMedium(command.medium);
  const unitCountParsing = parseUnitCount(command.unitCount);

  const issues: ValidationIssue[] = [];
  if (!titleValidation.isValid) {
    issues.push(titleValidation.issue);
  }
  if (medium === null) {
    issues.push({ field: WORK_MEDIUM_FIELD, code: WORK_MEDIUM_INVALID_CODE });
  }
  if (!unitCountParsing.isValid) {
    issues.push(unitCountParsing.issue);
  }

  if (!titleValidation.isValid || medium === null || !unitCountParsing.isValid) {
    throw new ValidationError(issues);
  }

  const creationTime = dependencies.getCurrentTime();
  const newWork: NewWork = {
    id: dependencies.generateWorkId(),
    universeId: viewerContext.universeId,
    title: titleValidation.title,
    medium,
    createdAt: creationTime,
    updatedAt: creationTime,
    units: buildNumberedUnits(unitCountParsing.unitCount),
  };

  await dependencies.workRepository.add(newWork);

  return toWorkDto({
    id: newWork.id,
    universeId: newWork.universeId,
    title: newWork.title,
    medium: newWork.medium,
    unitCount: newWork.units.length,
    createdAt: newWork.createdAt,
    updatedAt: newWork.updatedAt,
  });
}
