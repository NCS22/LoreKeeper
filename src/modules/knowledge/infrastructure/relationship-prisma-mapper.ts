import type {
  Entity as StoredEntity,
  Relationship as StoredRelationship,
} from "@/shared/infrastructure/generated/prisma/client";
import type { EntityRelationship } from "../domain/relationship";
import { toNarrativePoint, type StoredBoundaryWithDescription } from "./narrative-point-prisma-mapper";

/** A stored relationship row with the names of its two entities and its described boundary. */
export type StoredRelationshipWithEnds = StoredRelationship &
  StoredBoundaryWithDescription & {
    readonly sourceEntity: Pick<StoredEntity, "id" | "name">;
    readonly targetEntity: Pick<StoredEntity, "id" | "name">;
  };

/**
 * Turns a stored row into the relationship as it is read from one of its entities. Generated types
 * never leave this folder. The stored status is the PostgreSQL enum `KnowledgeStatus`, whose values
 * the type checker matches with the domain statuses.
 */
export function toEntityRelationship(storedRelationship: StoredRelationshipWithEnds): EntityRelationship {
  return {
    id: storedRelationship.id,
    relationshipTypeId: storedRelationship.relationshipTypeId,
    status: storedRelationship.status,
    source: { id: storedRelationship.sourceEntity.id, name: storedRelationship.sourceEntity.name },
    target: { id: storedRelationship.targetEntity.id, name: storedRelationship.targetEntity.name },
    revealedAt: toNarrativePoint(storedRelationship),
    createdAt: storedRelationship.createdAt,
  };
}
