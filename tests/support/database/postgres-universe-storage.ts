import { afterAll } from "vitest";
import type { Universe } from "@/modules/universes/domain/universe";
import { createPrismaRelationshipTypeRepository } from "@/modules/universes/infrastructure/prisma-relationship-type-repository";
import { createPrismaRememberedUniverseRepository } from "@/modules/universes/infrastructure/prisma-remembered-universe-repository";
import { createPrismaUniverseRepository } from "@/modules/universes/infrastructure/prisma-universe-repository";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { UniverseStorage } from "../contracts/universe-repository-contract";
import { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "../universe-owners";
import { createTestPrismaClient, emptyAuthenticationTables } from "./test-database";

// The trigger and its function that make the writes of relationship types fail, for the scenario
// "a universe whose types cannot be stored is not stored". Only the test database ever has them.
const RELATIONSHIP_TYPE_WRITE_FAILURE = "contract_relationship_type_write_failure";

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

async function makeRelationshipTypeWritesFail(): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION "${RELATIONSHIP_TYPE_WRITE_FAILURE}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'relationship type writes fail in this test'; END $$`,
  );
  await prismaClient.$executeRawUnsafe(
    `CREATE TRIGGER "${RELATIONSHIP_TYPE_WRITE_FAILURE}" BEFORE INSERT ON "RelationshipType" FOR EACH ROW EXECUTE FUNCTION "${RELATIONSHIP_TYPE_WRITE_FAILURE}"()`,
  );
}

async function restoreRelationshipTypeWrites(): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(
    `DROP TRIGGER IF EXISTS "${RELATIONSHIP_TYPE_WRITE_FAILURE}" ON "RelationshipType"`,
  );
  await prismaClient.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${RELATIONSHIP_TYPE_WRITE_FAILURE}"()`);
}

/**
 * An empty test database holding the two accounts the scenarios use and the given universes,
 * seen through the PostgreSQL repositories. A universe's owner must be one of those two accounts,
 * because the database requires the owner to exist. The starting universes are stored through the
 * repository, so each has its relationship types, as every universe has after the migration. The
 * database is shared, so a storage built later replaces the data of an earlier one, and a failure
 * of the relationship type writes left behind by an earlier test is removed.
 */
export async function createPostgresUniverseStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<UniverseStorage> {
  const prismaClient = getSharedClient();
  await restoreRelationshipTypeWrites();
  await emptyAuthenticationTables(prismaClient);
  await prismaClient.user.createMany({
    data: [FIRST_OWNER_ID, SECOND_OWNER_ID].map((ownerId) => ({
      id: ownerId,
      name: buildActingUser(ownerId).displayName,
      email: buildActingUser(ownerId).email,
    })),
  });
  const universeRepository = createPrismaUniverseRepository(getSharedClient);
  for (const startingUniverse of startingUniverses) {
    await universeRepository.add(startingUniverse);
  }

  return {
    universeRepository,
    rememberedUniverseRepository: createPrismaRememberedUniverseRepository(getSharedClient),
    relationshipTypeRepository: createPrismaRelationshipTypeRepository(getSharedClient),
    makeRelationshipTypeWritesFail,
    restoreRelationshipTypeWrites,
  };
}
