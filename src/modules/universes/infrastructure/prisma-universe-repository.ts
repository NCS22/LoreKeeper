import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { UniverseRepository } from "../domain/universe-repository";
import { runUniverseStorageOperation } from "./run-universe-storage-operation";
import { toDomainUniverse } from "./universe-prisma-mapper";

/**
 * Universes in PostgreSQL. Every query carries the owner and leaves out deleted rows, so a
 * universe of another account and a deleted one look the same as one that does not exist.
 * The client is asked for on each call, so building the repository touches nothing.
 */
export function createPrismaUniverseRepository(
  getPrismaClient: () => PrismaClient,
): UniverseRepository {
  return {
    findAllOwnedBy(ownerId) {
      return runUniverseStorageOperation("list the universes of an account", async () => {
        const storedUniverses = await getPrismaClient().universe.findMany({
          where: { ownerId, deletedAt: null },
          orderBy: [{ createdAt: "asc" }, { id: "asc" }],
        });
        return storedUniverses.map(toDomainUniverse);
      });
    },
    findOwnedById(ownerId, universeId) {
      return runUniverseStorageOperation("find a universe of an account", async () => {
        const storedUniverse = await getPrismaClient().universe.findFirst({
          where: { id: universeId, ownerId, deletedAt: null },
        });
        return storedUniverse === null ? null : toDomainUniverse(storedUniverse);
      });
    },
    add(universe) {
      return runUniverseStorageOperation("store a universe", async () => {
        await getPrismaClient().universe.create({
          data: {
            id: universe.id,
            ownerId: universe.ownerId,
            name: universe.name,
            description: universe.description,
            mode: universe.mode,
            createdAt: universe.createdAt,
            updatedAt: universe.updatedAt,
          },
        });
      });
    },
  };
}
