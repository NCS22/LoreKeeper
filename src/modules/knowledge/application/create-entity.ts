import type { ActingUser } from "@/shared/domain/acting-user";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { NewEntity, NewKnowledgeEntry } from "../domain/entity";
import { toComparableEntityName } from "../domain/entity-comparable-name";
import { validateEntityName } from "../domain/entity-name";
import type { EntityRepository } from "../domain/entity-repository";
import { ENTITY_TYPE_FIELD, ENTITY_TYPE_INVALID_CODE, parseEntityType } from "../domain/entity-type";
import { readFragmentContent } from "../domain/fragment-content";
import { KnowledgeItemNotFoundError } from "../domain/knowledge-errors";
import { parseKnowledgeItemId } from "../domain/knowledge-item-id";
import { KNOWLEDGE_STATUS_INVALID_CODE, parseKnowledgeStatus, type KnowledgeStatus } from "../domain/knowledge-status";
import { parseUnitNumber } from "../domain/unit-number";
import type { WorkRepository } from "../domain/work-repository";
import { toEntitySummaryDto, type EntitySummaryDto } from "./entity-dto";
import type { OwnUniverseLookup } from "./own-universe-lookup";
import { resolveViewerContext } from "./resolve-viewer-context";

/** Input paths of the entity form, as the validation issues name them (D17). */
export const ENTITY_BOUNDARY_WORK_ID_FIELD = "boundary.workId";
export const ENTITY_BOUNDARY_UNIT_NUMBER_FIELD = "boundary.unitNumber";
export const FRAGMENT_STATUS_FIELD = "fragment.status";
export const FRAGMENT_BOUNDARY_WORK_ID_FIELD = "fragment.boundary.workId";
export const FRAGMENT_BOUNDARY_UNIT_NUMBER_FIELD = "fragment.boundary.unitNumber";

export type CreateEntityDependencies = {
  readonly ownUniverseLookup: OwnUniverseLookup;
  readonly workRepository: WorkRepository;
  readonly entityRepository: EntityRepository;
  readonly generateEntityId: () => string;
  readonly generateFragmentId: () => string;
  readonly getCurrentTime: () => Date;
};

/** A point as the form sends it: a work and the number of one of its units, typed as text (D6). */
export type BoundaryCommand = {
  readonly workId: string;
  readonly unitNumber: string;
};

/** The optional first fragment. Without a boundary it takes the point of the entity (FR-5). */
export type FirstFragmentCommand = {
  readonly content: string;
  readonly status?: string | null;
  readonly boundary?: BoundaryCommand | null;
};

/** Input exactly as it arrives from the form; every rule is applied by the use case. */
export type CreateEntityCommand = {
  readonly universeId: string;
  readonly name: string;
  readonly type: string;
  readonly boundary: BoundaryCommand;
  readonly fragment?: FirstFragmentCommand | null;
};

/** The created entity and, when one exists, the name of the oldest similar entity (FR-6). */
export type EntityCreation = {
  readonly entity: EntitySummaryDto;
  readonly similarEntityName: string | null;
};

/** A well-formed point, not looked up yet. A `null` unit number names no unit of any work. */
type BoundaryReference = {
  readonly workId: string;
  readonly unitNumber: number | null;
};

type BoundaryReading = {
  readonly reference: BoundaryReference | null;
  readonly issues: readonly ValidationIssue[];
};

type FirstFragmentInput = {
  readonly content: string;
  readonly status: KnowledgeStatus;
  /** `null` when the fragment takes the point of its entity. */
  readonly boundaryReference: BoundaryReference | null;
};

type FirstFragmentReading = {
  /** `null` when there is no fragment, or when it has issues. */
  readonly fragmentInput: FirstFragmentInput | null;
  readonly issues: readonly ValidationIssue[];
};

function readBoundary(
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
 * Reads the first fragment. An empty or blank content means there is no fragment: its status and
 * boundary are not read at all, whatever they hold (FR-5).
 */
function readFirstFragment(fragment: FirstFragmentCommand | null | undefined): FirstFragmentReading {
  const contentReading = fragment == null ? null : readFragmentContent(fragment.content);
  if (fragment == null || contentReading === null || !contentReading.isPresent) {
    return { fragmentInput: null, issues: [] };
  }

  const status = parseKnowledgeStatus(fragment.status);
  const boundaryReading: BoundaryReading =
    fragment.boundary == null
      ? { reference: null, issues: [] }
      : readBoundary(fragment.boundary, FRAGMENT_BOUNDARY_WORK_ID_FIELD, FRAGMENT_BOUNDARY_UNIT_NUMBER_FIELD);

  const issues: ValidationIssue[] = [];
  if (!contentReading.isValid) {
    issues.push(contentReading.issue);
  }
  if (status === null) {
    issues.push({ field: FRAGMENT_STATUS_FIELD, code: KNOWLEDGE_STATUS_INVALID_CODE });
  }
  issues.push(...boundaryReading.issues);

  if (!contentReading.isValid || status === null || issues.length > 0) {
    return { fragmentInput: null, issues };
  }
  return {
    fragmentInput: { content: contentReading.content, status, boundaryReference: boundaryReading.reference },
    issues,
  };
}

/**
 * Looks the point up in the universe of the context. A work that does not exist, is deleted, is of
 * another account or of another universe, and a number with no unit in that work, all give the
 * same not found (FR-8).
 */
async function resolveBoundary(
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

async function buildFirstFragment(
  dependencies: CreateEntityDependencies,
  viewerContext: ViewerContext,
  fragmentInput: FirstFragmentInput | null,
  introducedAt: SpoilerBoundary,
): Promise<NewKnowledgeEntry | null> {
  if (fragmentInput === null) {
    return null;
  }
  const revealedAt =
    fragmentInput.boundaryReference === null
      ? introducedAt
      : await resolveBoundary(dependencies.workRepository, viewerContext, fragmentInput.boundaryReference);
  return {
    id: dependencies.generateFragmentId(),
    content: fragmentInput.content,
    status: fragmentInput.status,
    revealedAt,
  };
}

/**
 * Creates an entity, with an optional first fragment, in one own universe of the acting user
 * (FR-4, FR-5, FR-6). Order of checks: the universe first (another account's, a deleted and a
 * nonexistent universe give the same not found); then every field rule, reported together in one
 * `ValidationError`; then the points, looked up in the universe (one not found for every bad
 * reference). The entity and its fragment are stored in one all-or-nothing write. A similar
 * entity (same type and comparable name) never blocks the creation: its name comes back as a
 * notice. Nothing else of the command (attributes, a description, an owner) is read.
 */
export async function createEntity(
  dependencies: CreateEntityDependencies,
  actor: ActingUser,
  command: CreateEntityCommand,
): Promise<EntityCreation> {
  const viewerContext = await resolveViewerContext(dependencies, actor, command.universeId);

  const nameValidation = validateEntityName(command.name);
  const entityType = parseEntityType(command.type);
  const boundaryReading = readBoundary(
    command.boundary,
    ENTITY_BOUNDARY_WORK_ID_FIELD,
    ENTITY_BOUNDARY_UNIT_NUMBER_FIELD,
  );
  const fragmentReading = readFirstFragment(command.fragment);

  const issues: ValidationIssue[] = [];
  if (!nameValidation.isValid) {
    issues.push(nameValidation.issue);
  }
  if (entityType === null) {
    issues.push({ field: ENTITY_TYPE_FIELD, code: ENTITY_TYPE_INVALID_CODE });
  }
  issues.push(...boundaryReading.issues, ...fragmentReading.issues);

  if (!nameValidation.isValid || entityType === null || boundaryReading.reference === null || issues.length > 0) {
    throw new ValidationError(issues);
  }

  const introducedAt = await resolveBoundary(dependencies.workRepository, viewerContext, boundaryReading.reference);
  const firstFragment = await buildFirstFragment(
    dependencies,
    viewerContext,
    fragmentReading.fragmentInput,
    introducedAt,
  );

  const normalizedName = toComparableEntityName(nameValidation.name);
  const similarEntityName = await dependencies.entityRepository.findOldestNameOfSimilarEntity(
    viewerContext,
    entityType,
    normalizedName,
  );

  const creationTime = dependencies.getCurrentTime();
  const newEntity: NewEntity = {
    id: dependencies.generateEntityId(),
    universeId: viewerContext.universeId,
    type: entityType,
    name: nameValidation.name,
    normalizedName,
    introducedAt,
    createdAt: creationTime,
    updatedAt: creationTime,
    firstFragment,
  };

  await dependencies.entityRepository.add(newEntity);

  return {
    entity: toEntitySummaryDto(newEntity),
    similarEntityName,
  };
}
