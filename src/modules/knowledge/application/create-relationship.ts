import type { ActingUser } from "@/shared/domain/acting-user";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { EntityRepository } from "../domain/entity-repository";
import { KnowledgeItemNotFoundError, RelationshipToItselfError } from "../domain/knowledge-errors";
import { parseKnowledgeItemId } from "../domain/knowledge-item-id";
import { KNOWLEDGE_STATUS_INVALID_CODE, parseKnowledgeStatus } from "../domain/knowledge-status";
import type { NewRelationship } from "../domain/relationship";
import type { RelationshipRepository } from "../domain/relationship-repository";
import type { WorkRepository } from "../domain/work-repository";
import { readBoundary, resolveBoundary, type BoundaryCommand } from "./boundary-reference";
import type { OwnUniverseLookup } from "./own-universe-lookup";
import type { RelationshipTypeCatalog } from "./relationship-type-catalog";
import { resolveViewerContext } from "./resolve-viewer-context";

/** Input paths of the relationship form, as the validation issues name them (D17). */
export const RELATIONSHIP_SOURCE_ENTITY_ID_FIELD = "sourceEntityId";
export const RELATIONSHIP_TARGET_ENTITY_ID_FIELD = "targetEntityId";
export const RELATIONSHIP_TYPE_ID_FIELD = "relationshipTypeId";
export const RELATIONSHIP_STATUS_FIELD = "status";
export const RELATIONSHIP_BOUNDARY_WORK_ID_FIELD = "boundary.workId";
export const RELATIONSHIP_BOUNDARY_UNIT_NUMBER_FIELD = "boundary.unitNumber";

export type CreateRelationshipDependencies = {
  readonly ownUniverseLookup: OwnUniverseLookup;
  readonly workRepository: WorkRepository;
  readonly entityRepository: EntityRepository;
  readonly relationshipRepository: RelationshipRepository;
  readonly relationshipTypeCatalog: RelationshipTypeCatalog;
  readonly generateRelationshipId: () => string;
  readonly getCurrentTime: () => Date;
};

/** Input exactly as it arrives from the form; every rule is applied by the use case. */
export type CreateRelationshipCommand = {
  readonly universeId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly relationshipTypeId: string;
  readonly status?: string | null;
  readonly boundary: BoundaryCommand;
};

/** The created relationship as seen outside the module: its identifier and its two entities. */
export type CreatedRelationshipDto = {
  readonly id: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
};

async function findEntityOfUniverse(
  entityRepository: EntityRepository,
  viewerContext: ViewerContext,
  entityId: string,
): Promise<void> {
  if ((await entityRepository.findInUniverse(viewerContext, entityId)) === null) {
    throw new KnowledgeItemNotFoundError();
  }
}

async function findRelationshipTypeOfUniverse(
  relationshipTypeCatalog: RelationshipTypeCatalog,
  viewerContext: ViewerContext,
  relationshipTypeId: string,
): Promise<void> {
  const relationshipTypes = await relationshipTypeCatalog.listRelationshipTypes(viewerContext);
  if (!relationshipTypes.some((relationshipType) => relationshipType.id === relationshipTypeId)) {
    throw new KnowledgeItemNotFoundError();
  }
}

/**
 * Creates one directed relationship from a source entity to a target entity in one own universe of
 * the acting user (FR-7, FR-8). Order of checks: the universe first (another account's, a deleted
 * and a nonexistent universe give the same not found); then every field rule, reported together in
 * one `ValidationError`; then the source and target being the same entity, a business rule checked
 * before any lookup so it never tells whether the entity exists; then the source, target, type and
 * point, looked up in the universe, with one not found for every bad reference. The same pair may
 * be related again with the same type, in either direction, and the point is independent of the
 * points of the entities. Nothing else of the command (a description, an owner) is read.
 */
export async function createRelationship(
  dependencies: CreateRelationshipDependencies,
  actor: ActingUser,
  command: CreateRelationshipCommand,
): Promise<CreatedRelationshipDto> {
  const viewerContext = await resolveViewerContext(dependencies, actor, command.universeId);

  const sourceParsing = parseKnowledgeItemId(command.sourceEntityId, RELATIONSHIP_SOURCE_ENTITY_ID_FIELD);
  const targetParsing = parseKnowledgeItemId(command.targetEntityId, RELATIONSHIP_TARGET_ENTITY_ID_FIELD);
  const typeParsing = parseKnowledgeItemId(command.relationshipTypeId, RELATIONSHIP_TYPE_ID_FIELD);
  const status = parseKnowledgeStatus(command.status);
  const boundaryReading = readBoundary(
    command.boundary,
    RELATIONSHIP_BOUNDARY_WORK_ID_FIELD,
    RELATIONSHIP_BOUNDARY_UNIT_NUMBER_FIELD,
  );

  const issues: ValidationIssue[] = [];
  for (const parsing of [sourceParsing, targetParsing, typeParsing]) {
    if (!parsing.isValid) {
      issues.push(parsing.issue);
    }
  }
  if (status === null) {
    issues.push({ field: RELATIONSHIP_STATUS_FIELD, code: KNOWLEDGE_STATUS_INVALID_CODE });
  }
  issues.push(...boundaryReading.issues);

  if (
    !sourceParsing.isValid ||
    !targetParsing.isValid ||
    !typeParsing.isValid ||
    status === null ||
    boundaryReading.reference === null
  ) {
    throw new ValidationError(issues);
  }

  if (sourceParsing.itemId === targetParsing.itemId) {
    throw new RelationshipToItselfError();
  }

  await findEntityOfUniverse(dependencies.entityRepository, viewerContext, sourceParsing.itemId);
  await findEntityOfUniverse(dependencies.entityRepository, viewerContext, targetParsing.itemId);
  await findRelationshipTypeOfUniverse(dependencies.relationshipTypeCatalog, viewerContext, typeParsing.itemId);
  const revealedAt = await resolveBoundary(dependencies.workRepository, viewerContext, boundaryReading.reference);

  const creationTime = dependencies.getCurrentTime();
  const newRelationship: NewRelationship = {
    id: dependencies.generateRelationshipId(),
    universeId: viewerContext.universeId,
    relationshipTypeId: typeParsing.itemId,
    sourceEntityId: sourceParsing.itemId,
    targetEntityId: targetParsing.itemId,
    status,
    revealedAt,
    createdAt: creationTime,
    updatedAt: creationTime,
  };

  await dependencies.relationshipRepository.add(newRelationship);

  return {
    id: newRelationship.id,
    sourceEntityId: newRelationship.sourceEntityId,
    targetEntityId: newRelationship.targetEntityId,
  };
}
