import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { EntityRepository } from "../domain/entity-repository";
import { KnowledgeItemNotFoundError } from "../domain/knowledge-errors";
import { parseKnowledgeItemId } from "../domain/knowledge-item-id";
import type { EntityRelationship } from "../domain/relationship";
import { readRelationshipFromSide } from "../domain/relationship-reading";
import type { RelationshipRepository } from "../domain/relationship-repository";
import {
  toEntityDetailsDto,
  toPointDto,
  type EntityDetailsDto,
  type RelationshipReadingDto,
} from "./entity-details-dto";
import type { RelationshipTypeCatalog, RelationshipTypeDto } from "./relationship-type-catalog";

/** Input path of the entity of the details, as the validation issue names it. */
export const ENTITY_ID_FIELD = "entityId";

export type GetEntityDetailsDependencies = {
  readonly entityRepository: EntityRepository;
  readonly relationshipRepository: RelationshipRepository;
  readonly relationshipTypeCatalog: RelationshipTypeCatalog;
};

function readRelationshipFromEntity(
  entityId: string,
  relationship: EntityRelationship,
  relationshipTypesById: ReadonlyMap<string, RelationshipTypeDto>,
): RelationshipReadingDto {
  const relationshipType = relationshipTypesById.get(relationship.relationshipTypeId);
  if (relationshipType === undefined) {
    // The database keeps the type of every relationship in its universe, so this only happens when
    // the storage disagrees with itself; the generic failure is answered, never a broken reading.
    throw new InfrastructureError("A relationship refers to a type that the catalog of its universe does not hold.");
  }
  const side = relationship.source.id === entityId ? "SOURCE" : "TARGET";
  return {
    id: relationship.id,
    status: relationship.status,
    point: toPointDto(relationship.revealedAt),
    ...readRelationshipFromSide(relationship, relationshipType, side),
  };
}

/**
 * The details of one entity of the universe of the context (FR-10): name, type, introduction
 * point, its oldest fragment with its point, and all its relationships in creation order, each read
 * from this entity with the label (as source) or the inverse label (as target) of the catalog. An
 * entity of another universe, of another account, deleted or nonexistent gives the single not
 * found; a malformed identifier is a validation error on `entityId`.
 *
 * Temporary exception of spec 006 (2026-11-25): no visibility rule is applied, the fragment and
 * every relationship are shown in READER and AUTHOR universes alike, until the Phase 4 spec that
 * filters the reads of spec 006 filters this one by the reading position.
 */
export async function getEntityDetails(
  dependencies: GetEntityDetailsDependencies,
  viewerContext: ViewerContext,
  entityId: string,
): Promise<EntityDetailsDto> {
  const entityIdParsing = parseKnowledgeItemId(entityId, ENTITY_ID_FIELD);
  if (!entityIdParsing.isValid) {
    throw new ValidationError([entityIdParsing.issue]);
  }

  const entityDetails = await dependencies.entityRepository.findDetailsInUniverse(
    viewerContext,
    entityIdParsing.itemId,
  );
  if (entityDetails === null) {
    throw new KnowledgeItemNotFoundError();
  }

  const relationships = await dependencies.relationshipRepository.findAllOfEntity(viewerContext, entityDetails.id);
  const relationshipTypes = await dependencies.relationshipTypeCatalog.listRelationshipTypes(viewerContext);
  const relationshipTypesById = new Map(
    relationshipTypes.map((relationshipType) => [relationshipType.id, relationshipType] as const),
  );

  return toEntityDetailsDto(
    entityDetails,
    relationships.map((relationship) =>
      readRelationshipFromEntity(entityDetails.id, relationship, relationshipTypesById),
    ),
  );
}
