import { afterAll } from "vitest";
import type { Universe } from "@/modules/universes/domain/universe";
import { createPrismaRememberedUniverseRepository } from "@/modules/universes/infrastructure/prisma-remembered-universe-repository";
import { createPrismaUniverseRepository } from "@/modules/universes/infrastructure/prisma-universe-repository";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { UniverseStorage } from "../contracts/universe-repository-contract";
import { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "../universe-owners";
import { createTestPrismaClient, emptyAuthenticationTables } from "./test-database";

let sharedClient: PrismaClient | null = null;

// One client per test file, closed when the file ends. It is created on first use, never at import.
afterAll(async () => {
  await sharedClient?.$disconnect();
  sharedClient = null;
});

function getSharedClient(): PrismaClient {
  sharedClient ??= createTestPrismaClient();
  return sharedClient;
}

/**
 * An empty test database holding the two accounts the scenarios use and the given universes,
 * seen through the PostgreSQL repositories. A universe's owner must be one of those two accounts,
 * because the database requires the owner to exist. The database is shared, so a storage built
 * later replaces the data of an earlier one.
 */
export async function createPostgresUniverseStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<UniverseStorage> {
  const prismaClient = getSharedClient();
  await emptyAuthenticationTables(prismaClient);
  await prismaClient.user.createMany({
    data: [FIRST_OWNER_ID, SECOND_OWNER_ID].map((ownerId) => ({
      id: ownerId,
      name: buildActingUser(ownerId).displayName,
      email: buildActingUser(ownerId).email,
    })),
  });
  await prismaClient.universe.createMany({ data: startingUniverses.map((universe) => ({ ...universe })) });

  return {
    universeRepository: createPrismaUniverseRepository(getSharedClient),
    rememberedUniverseRepository: createPrismaRememberedUniverseRepository(getSharedClient),
  };
}
