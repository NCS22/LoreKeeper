import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { EntityRepository } from "../domain/entity-repository";
import { toDomainEntity, toEntityDetails } from "./entity-prisma-mapper";
import { BOUNDARY_DESCRIPTION_INCLUDE } from "./narrative-point-prisma-mapper";
import { runKnowledgeStorageOperation } from "./run-knowledge-storage-operation";

/**
 * Entities and their fragments in PostgreSQL. Every query is limited to one universe and leaves out
 * deleted rows. The ownership of that universe is checked before, by the use cases, through the
 * universes module; this repository never reads the universes table. The composite foreign keys
 * refuse a boundary whose work is of another universe or whose unit is of another work. The client
 * is asked for on each call, so building the repository touches nothing.
 */
export function createPrismaEntityRepository(getPrismaClient: () => PrismaClient): EntityRepository {
  return {
    add(newEntity) {
      return runKnowledgeStorageOperation("store an entity with its first fragment", async () => {
        const { firstFragment } = newEntity;
        // One nested write, so one transaction: the entity and its fragment, or nothing (FR-5).
        // The fragment takes the universe of its entity from the parent row. Attributes keep their
        // default `{}`: nothing of them comes from the request.
        await getPrismaClient().entity.create({
          data: {
            id: newEntity.id,
            universeId: newEntity.universeId,
            type: newEntity.type,
            name: newEntity.name,
            normalizedName: newEntity.normalizedName,
            boundaryWorkId: newEntity.introducedAt.workId,
            boundaryUnitId: newEntity.introducedAt.unitId,
            createdAt: newEntity.createdAt,
            updatedAt: newEntity.updatedAt,
            knowledgeEntries:
              firstFragment === null
                ? undefined
                : {
                    create: {
                      id: firstFragment.id,
                      content: firstFragment.content,
                      status: firstFragment.status,
                      boundaryWorkId: firstFragment.revealedAt.workId,
                      boundaryUnitId: firstFragment.revealedAt.unitId,
                      createdAt: newEntity.createdAt,
                      updatedAt: newEntity.updatedAt,
                    },
                  },
          },
        });
      });
    },
    // Temporary exception of spec 006 (2026-11-25): no visibility rule, every entity of the own
    // universe is returned in READER and AUTHOR universes alike; it ends with the Phase 4 spec that
    // filters the reads of spec 006, which filters this method by the reading position.
    findAllInUniverse(viewerContext) {
      return runKnowledgeStorageOperation("list the entities of a universe", async () => {
        const storedEntities = await getPrismaClient().entity.findMany({
          where: { universeId: viewerContext.universeId, deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        return storedEntities.map(toDomainEntity);
      });
    },
    // Read for the duplicate-name notice of a creation (FR-6), under the same temporary exception:
    // it compares with every entity of the own universe, whatever the reading position.
    findOldestNameOfSimilarEntity(viewerContext, entityType, normalizedName) {
      return runKnowledgeStorageOperation("look for an entity with the same name", async () => {
        const similarEntity = await getPrismaClient().entity.findFirst({
          where: { universeId: viewerContext.universeId, type: entityType, normalizedName, deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
          select: { name: true },
        });
        return similarEntity?.name ?? null;
      });
    },
    // Read to check a reference of a creation (FR-8): the entity must be of the universe.
    findInUniverse(viewerContext, entityId) {
      return runKnowledgeStorageOperation("find an entity", async () => {
        const storedEntity = await getPrismaClient().entity.findFirst({
          where: { id: entityId, universeId: viewerContext.universeId, deletedAt: null },
        });
        return storedEntity === null ? null : toDomainEntity(storedEntity);
      });
    },
    // Temporary exception of spec 006 (2026-11-25): no visibility rule, the entity and its oldest
    // fragment are returned in READER and AUTHOR universes alike; it ends with the Phase 4 spec that
    // filters the reads of spec 006, which filters this method by the reading position.
    findDetailsInUniverse(viewerContext, entityId) {
      return runKnowledgeStorageOperation("read the details of an entity", async () => {
        const storedEntity = await getPrismaClient().entity.findFirst({
          where: { id: entityId, universeId: viewerContext.universeId, deletedAt: null },
          include: {
            ...BOUNDARY_DESCRIPTION_INCLUDE,
            knowledgeEntries: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: "asc" }, { id: "asc" }],
              take: 1,
              include: BOUNDARY_DESCRIPTION_INCLUDE,
            },
          },
        });
        return storedEntity === null ? null : toEntityDetails(storedEntity);
      });
    },
  };
}
