import { afterAll } from "vitest";
import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import type { Universe } from "@/modules/universes/domain/universe";
import { createPrismaEntityRepository } from "@/modules/knowledge/infrastructure/prisma-entity-repository";
import { createPrismaRelationshipRepository } from "@/modules/knowledge/infrastructure/prisma-relationship-repository";
import { createPrismaWorkRepository } from "@/modules/knowledge/infrastructure/prisma-work-repository";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { KnowledgeStorage } from "../contracts/work-repository-contract";
import { createRelationshipTypeCatalogOverRepository } from "../relationship-type-catalog-over-repository";
import { createPostgresUniverseStorage } from "./postgres-universe-storage";
import { createTestPrismaClient } from "./test-database";

// The trigger and its function that make the writes of narrative units fail, for the scenario "a
// work whose units cannot be stored is not stored". Only the test database ever has them.
const UNIT_WRITE_FAILURE = "contract_narrative_unit_write_failure";
// The same for the writes of knowledge entries (fragments).
const FRAGMENT_WRITE_FAILURE = "contract_knowledge_entry_write_failure";

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

async function makeInsertsFail(failureName: string, tableName: string): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(
    `CREATE OR REPLACE FUNCTION "${failureName}"() RETURNS trigger LANGUAGE plpgsql AS $$ BEGIN RAISE EXCEPTION 'writes of ${tableName} fail in this test'; END $$`,
  );
  await prismaClient.$executeRawUnsafe(
    `CREATE TRIGGER "${failureName}" BEFORE INSERT ON "${tableName}" FOR EACH ROW EXECUTE FUNCTION "${failureName}"()`,
  );
}

async function restoreInserts(failureName: string, tableName: string): Promise<void> {
  const prismaClient = getSharedClient();
  await prismaClient.$executeRawUnsafe(`DROP TRIGGER IF EXISTS "${failureName}" ON "${tableName}"`);
  await prismaClient.$executeRawUnsafe(`DROP FUNCTION IF EXISTS "${failureName}"()`);
}

const makeUnitWritesFail = () => makeInsertsFail(UNIT_WRITE_FAILURE, "NarrativeUnit");
const restoreUnitWrites = () => restoreInserts(UNIT_WRITE_FAILURE, "NarrativeUnit");
const makeFragmentWritesFail = () => makeInsertsFail(FRAGMENT_WRITE_FAILURE, "KnowledgeEntry");
const restoreFragmentWrites = () => restoreInserts(FRAGMENT_WRITE_FAILURE, "KnowledgeEntry");

/**
 * An empty test database holding the two test accounts and the given universes (through the
 * universes storage), seen through the PostgreSQL repositories of the knowledge module. Building
 * it replaces the data of an earlier storage, and removes a failure of the unit or fragment
 * writes left behind by an earlier test.
 */
export async function createPostgresKnowledgeStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<KnowledgeStorage> {
  await restoreUnitWrites();
  await restoreFragmentWrites();
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
    async readLabelOfStoredUnit(unitId) {
      const storedUnit = await getSharedClient().narrativeUnit.findUnique({
        where: { id: unitId },
        select: { label: true },
      });
      return storedUnit?.label ?? null;
    },
    entityRepository: createPrismaEntityRepository(getSharedClient),
    async readStoredFragmentsOfEntity(entityId) {
      const storedFragments = await getSharedClient().knowledgeEntry.findMany({
        where: { entityId },
        orderBy: [{ createdAt: "asc" }, { id: "asc" }],
      });
      return storedFragments.map((storedFragment) => ({
        content: storedFragment.content,
        status: storedFragment.status,
        revealedAt: { workId: storedFragment.boundaryWorkId, unitId: storedFragment.boundaryUnitId },
      }));
    },
    countStoredEntities: () => getSharedClient().entity.count(),
    countStoredFragments: () => getSharedClient().knowledgeEntry.count(),
    makeFragmentWritesFail,
    restoreFragmentWrites,
    relationshipRepository: createPrismaRelationshipRepository(getSharedClient),
    countStoredRelationships: () => getSharedClient().relationship.count(),
    relationshipTypeCatalog: createRelationshipTypeCatalogOverRepository(universeStorage.relationshipTypeRepository),
  };
}
