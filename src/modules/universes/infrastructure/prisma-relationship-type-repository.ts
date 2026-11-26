import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { RelationshipTypeRepository } from "../domain/relationship-type-repository";
import { runUniverseStorageOperation } from "./run-universe-storage-operation";

/**
 * The relationship type catalog in PostgreSQL, read only. Every query carries the owner through the
 * universe and leaves out deleted types and deleted universes, so the types of a universe of another
 * account look the same as those of a universe that does not exist: none.
 */
export function createPrismaRelationshipTypeRepository(
  getPrismaClient: () => PrismaClient,
): RelationshipTypeRepository {
  return {
    // Temporary exception of spec 006 (2026-11-25): no visibility rule, the whole catalog of the own
    // universe is returned; it ends with the Phase 4 spec that filters the reads of spec 006.
    findAllInOwnedUniverse(ownerId, universeId) {
      return runUniverseStorageOperation("list the relationship types of a universe", async () =>
        getPrismaClient().relationshipType.findMany({
          where: { universeId, deletedAt: null, universe: { ownerId, deletedAt: null } },
          orderBy: { key: "asc" },
          select: {
            id: true,
            universeId: true,
            key: true,
            label: true,
            inverseLabel: true,
            isSymmetric: true,
            isPredefined: true,
          },
        }),
      );
    },
  };
}
