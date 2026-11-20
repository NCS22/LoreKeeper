import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { RememberedUniverseRepository } from "../domain/remembered-universe-repository";
import { runUniverseStorageOperation } from "./run-universe-storage-operation";

/**
 * The remembered universe of each account in PostgreSQL: one row per account, the last write
 * wins. The database refuses a universe that belongs to another account, and a remembered
 * universe that was deleted reads as none.
 */
export function createPrismaRememberedUniverseRepository(
  getPrismaClient: () => PrismaClient,
): RememberedUniverseRepository {
  return {
    findRememberedUniverseId(ownerId) {
      return runUniverseStorageOperation("read the remembered universe", async () => {
        const rememberedRow = await getPrismaClient().rememberedUniverse.findFirst({
          where: { userId: ownerId, universe: { deletedAt: null } },
          select: { universeId: true },
        });
        return rememberedRow === null ? null : rememberedRow.universeId;
      });
    },
    saveRememberedUniverse(ownerId, universeId) {
      return runUniverseStorageOperation("remember a universe", async () => {
        await getPrismaClient().rememberedUniverse.upsert({
          where: { userId: ownerId },
          create: { userId: ownerId, universeId },
          update: { universeId },
        });
      });
    },
  };
}
