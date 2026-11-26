import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { RelationshipRepository } from "../domain/relationship-repository";
import { BOUNDARY_DESCRIPTION_INCLUDE } from "./narrative-point-prisma-mapper";
import { toEntityRelationship } from "./relationship-prisma-mapper";
import { runKnowledgeStorageOperation } from "./run-knowledge-storage-operation";

/**
 * Relationships in PostgreSQL. Every query is limited to one universe and leaves out deleted rows.
 * The ownership of that universe is checked before, by the use cases, through the universes module;
 * this repository never reads the universes or relationship type tables. The composite foreign keys
 * refuse an entity, a type or a boundary of another universe and a unit of another work, and a
 * `CHECK` refuses an entity related to itself. The client is asked for on each call, so building
 * the repository touches nothing.
 */
export function createPrismaRelationshipRepository(getPrismaClient: () => PrismaClient): RelationshipRepository {
  return {
    add(newRelationship) {
      return runKnowledgeStorageOperation("store a relationship", async () => {
        await getPrismaClient().relationship.create({
          data: {
            id: newRelationship.id,
            universeId: newRelationship.universeId,
            relationshipTypeId: newRelationship.relationshipTypeId,
            sourceEntityId: newRelationship.sourceEntityId,
            targetEntityId: newRelationship.targetEntityId,
            status: newRelationship.status,
            boundaryWorkId: newRelationship.revealedAt.workId,
            boundaryUnitId: newRelationship.revealedAt.unitId,
            createdAt: newRelationship.createdAt,
            updatedAt: newRelationship.updatedAt,
          },
        });
      });
    },
    // Temporary exception of spec 006 (2026-11-25): no visibility rule, every relationship of the
    // entity in the own universe is returned in READER and AUTHOR universes alike; it ends with the
    // Phase 4 spec that filters the reads of spec 006, which filters this method by the reading
    // position. The names of both entities and the point are read in the same query.
    findAllOfEntity(viewerContext, entityId) {
      return runKnowledgeStorageOperation("list the relationships of an entity", async () => {
        const storedRelationships = await getPrismaClient().relationship.findMany({
          where: {
            universeId: viewerContext.universeId,
            deletedAt: null,
            OR: [{ sourceEntityId: entityId }, { targetEntityId: entityId }],
            sourceEntity: { deletedAt: null },
            targetEntity: { deletedAt: null },
          },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          include: {
            sourceEntity: { select: { id: true, name: true } },
            targetEntity: { select: { id: true, name: true } },
            ...BOUNDARY_DESCRIPTION_INCLUDE,
          },
        });
        return storedRelationships.map(toEntityRelationship);
      });
    },
  };
}
