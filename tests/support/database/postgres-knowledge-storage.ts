import { afterAll } from "vitest";
import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import type { Universe } from "@/modules/universes/domain/universe";
import { createPrismaWorkRepository } from "@/modules/knowledge/infrastructure/prisma-work-repository";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { KnowledgeStorage } from "../contracts/work-repository-contract";
import { createPostgresUniverseStorage } from "./postgres-universe-storage";
import { createTestPrismaClient } from "./test-database";

// The trigger and its function that make the writes of narrative units fail, for the scenario "a
// work whose units cannot be stored is not stored". Only the test database ever has them.
const UNIT_WRITE_FAILURE = "contract_narrative_unit_write_failure";

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

async function makeUnitWritesFail(): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION "${UNIT_WRITE_FAILURE}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'narrative unit writes fail in this test'; END $$`,
  );
  await prismaClient.$executeRawUnsafe(
    `CREATE TRIGGER "${UNIT_WRITE_FAILURE}" BEFORE INSERT ON "NarrativeUnit" FOR EACH ROW EXECUTE FUNCTION "${UNIT_WRITE_FAILURE}"()`,
  );
}

async function restoreUnitWrites(): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${UNIT_WRITE_FAILURE}" ON "NarrativeUnit"`);
  await prismaClient.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${UNIT_WRITE_FAILURE}"()`);
}

/**
 * An empty test database holding the two test accounts and the given universes (through the
 * universes storage), seen through the PostgreSQL repositories of the knowledge module. Building
 * it replaces the data of an earlier storage, and removes a failure of the unit writes left
 * behind by an earlier test.
 */
export async function createPostgresKnowledgeStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<KnowledgeStorage> {
  await restoreUnitWrites();
  const universeStorage = await createPostgresUniverseStorage(startingUniverses);
  const universeRepository = universeStorage.universeRepository;

  return {
    ownUniverseLookup: {
      findOwnUniverse: (actor, universeId) => findOwnUniverse({ universeRepository }, actor, universeId),
    },
    workRepository: createPrismaWorkRepository(getSharedClient),
    async readStoredUnitsOfWork(workId) {
      return getSharedClient().narrativeUnit.findMany({
        where: { workId },
        orderBy: { ordinal: "asc" },
        select: { label: true, ordinal: true },
      });
    },
    countStoredWorks: () => getSharedClient().work.count(),
    makeUnitWritesFail,
    restoreUnitWrites,
  };
}
