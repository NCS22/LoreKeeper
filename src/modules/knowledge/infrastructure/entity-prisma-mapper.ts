import type {
  Entity as StoredEntity,
  KnowledgeEntry as StoredKnowledgeEntry,
} from "@/shared/infrastructure/generated/prisma/client";
import type { Entity, EntityDetails } from "../domain/entity";
import { toNarrativePoint, type StoredBoundaryWithDescription } from "./narrative-point-prisma-mapper";

/** A stored entity row with its described boundary and at most its oldest fragment, also described. */
export type StoredEntityWithDetails = StoredEntity &
  StoredBoundaryWithDescription & {
    readonly knowledgeEntries: ReadonlyArray<StoredKnowledgeEntry & StoredBoundaryWithDescription>;
  };

/**
 * Turns a stored row into the domain entity. Generated types never leave this folder. The stored
 * type is the PostgreSQL enum `EntityType`, whose values the type checker matches with the domain
 * types, so no unknown value can arrive here. Attributes are not read: they are always empty.
 */
export function toDomainEntity(storedEntity: StoredEntity): Entity {
  return {
    id: storedEntity.id,
    universeId: storedEntity.universeId,
    type: storedEntity.type,
    name: storedEntity.name,
    introducedAt: { workId: storedEntity.boundaryWorkId, unitId: storedEntity.boundaryUnitId },
    createdAt: storedEntity.createdAt,
    updatedAt: storedEntity.updatedAt,
  };
}

/**
 * Turns a stored row, read with its oldest fragment, into the details of the entity. The stored
 * status is the PostgreSQL enum `KnowledgeStatus`, matched with the domain statuses.
 */
export function toEntityDetails(storedEntity: StoredEntityWithDetails): EntityDetails {
  const [firstFragment] = storedEntity.knowledgeEntries;
  return {
    id: storedEntity.id,
    type: storedEntity.type,
    name: storedEntity.name,
    introducedAt: toNarrativePoint(storedEntity),
    firstFragment:
      firstFragment === undefined
        ? null
        : {
            content: firstFragment.content,
            status: firstFragment.status,
            revealedAt: toNarrativePoint(firstFragment),
          },
  };
}
