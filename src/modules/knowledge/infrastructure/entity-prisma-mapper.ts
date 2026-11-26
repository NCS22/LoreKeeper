import type { Entity as StoredEntity } from "@/shared/infrastructure/generated/prisma/client";
import type { Entity } from "../domain/entity";

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
