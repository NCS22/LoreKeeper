import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaRelationshipTypeRepository } from "@/modules/universes/infrastructure/prisma-relationship-type-repository";
import { createPrismaUniverseRepository } from "@/modules/universes/infrastructure/prisma-universe-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  EXPECTED_PREDEFINED_RELATIONSHIP_TYPES,
  withoutStoredIdentifiers,
} from "../../../support/contracts/universe-repository-contract";
import { createPostgresUniverseStorage } from "../../../support/database/postgres-universe-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { FIRST_OWNER_ID, SECOND_OWNER_ID } from "../../../support/universe-owners";
import { buildUniverse } from "../../../support/universe-repository-factories";

const MIGRATIONS_FOLDER = resolve(process.cwd(), "prisma/migrations");
const BACKFILL_START_MARKER = "-- BEGIN predefined relationship types backfill";
const BACKFILL_END_MARKER = "-- END predefined relationship types backfill";

/** The backfill block of the migration that created the relationship types, as it is written. */
function readBackfillStatementOfTheMigration(): string {
  const migrationFolder = readdirSync(MIGRATIONS_FOLDER).find((folderName) =>
    folderName.endsWith("_create_knowledge_items"),
  );
  if (migrationFolder === undefined) {
    throw new Error("The migration create_knowledge_items was not found.");
  }
  const migrationText = readFileSync(join(MIGRATIONS_FOLDER, migrationFolder, "migration.sql"), "utf8");
  const blockStart = migrationText.indexOf(BACKFILL_START_MARKER);
  const blockEnd = migrationText.indexOf(BACKFILL_END_MARKER);
  if (blockStart === -1 || blockEnd === -1) {
    throw new Error("The backfill block of the migration has no markers.");
  }
  return migrationText
    .slice(blockStart, blockEnd)
    .split(/\r?\n/u)
    .filter((line) => !line.trimStart().startsWith("--"))
    .join("\n")
    .trim()
    .replace(/;$/u, "");
}

describe("PostgreSQL relationship type repository", () => {
  let client: PrismaClient;
  const relationshipTypeRepository = createPrismaRelationshipTypeRepository(() => client);
  const universeRepository = createPrismaUniverseRepository(() => client);
  const universeStoredBeforeTheMigration = buildUniverse({
    id: "00000000-0000-4000-8000-0000000000b1",
    name: "Stored before the migration",
  });

  beforeEach(async () => {
    await client?.$disconnect();
    client = createTestPrismaClient();
    await createPostgresUniverseStorage();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  async function insertUniverseWithoutTypes(): Promise<void> {
    await client.universe.create({ data: { ...universeStoredBeforeTheMigration } });
  }

  async function runBackfillOfTheMigration(): Promise<void> {
    await client.$executeRawUnsafe(readBackfillStatementOfTheMigration());
  }

  describe("backfill of the migration", () => {
    it("gives a universe stored without types exactly the eight predefined types of the seed", async () => {
      await insertUniverseWithoutTypes();
      expect(
        await relationshipTypeRepository.findAllInOwnedUniverse(
          FIRST_OWNER_ID,
          universeStoredBeforeTheMigration.id,
        ),
      ).toEqual([]);

      await runBackfillOfTheMigration();

      const backfilledTypes = await relationshipTypeRepository.findAllInOwnedUniverse(
        FIRST_OWNER_ID,
        universeStoredBeforeTheMigration.id,
      );
      expect(backfilledTypes.map(withoutStoredIdentifiers)).toEqual(EXPECTED_PREDEFINED_RELATIONSHIP_TYPES);
    });

    it("writes the same types as a universe created after it gets", async () => {
      await insertUniverseWithoutTypes();
      const createdUniverse = buildUniverse({ id: "00000000-0000-4000-8000-0000000000b2" });
      await universeRepository.add(createdUniverse);
      const typesOfCreatedUniverse = await relationshipTypeRepository.findAllInOwnedUniverse(
        FIRST_OWNER_ID,
        createdUniverse.id,
      );

      await runBackfillOfTheMigration();

      const backfilledTypes = await relationshipTypeRepository.findAllInOwnedUniverse(
        FIRST_OWNER_ID,
        universeStoredBeforeTheMigration.id,
      );
      expect(typesOfCreatedUniverse).toHaveLength(8);
      expect(backfilledTypes.map(withoutStoredIdentifiers)).toEqual(
        typesOfCreatedUniverse.map(withoutStoredIdentifiers),
      );
    });

    it("adds no second copy when it runs again or meets a universe that already has its types", async () => {
      await insertUniverseWithoutTypes();
      const createdUniverse = buildUniverse({ id: "00000000-0000-4000-8000-0000000000b2" });
      await universeRepository.add(createdUniverse);

      await runBackfillOfTheMigration();
      await runBackfillOfTheMigration();

      expect(await client.relationshipType.count()).toBe(16);
      expect(
        await client.relationshipType.count({ where: { universeId: createdUniverse.id } }),
      ).toBe(8);
    });
  });

  describe("integrity of the catalog", () => {
    it("refuses at the database a second type with the same key in a universe while the first is not deleted", async () => {
      const universe = buildUniverse();
      await universeRepository.add(universe);

      await expect(
        client.relationshipType.create({
          data: {
            universeId: universe.id,
            key: "MEMBER_OF",
            label: "member of",
            inverseLabel: "has member",
            isSymmetric: false,
            isPredefined: true,
          },
        }),
      ).rejects.toMatchObject({
        name: "PrismaClientKnownRequestError",
        code: "P2002",
        meta: {
          driverAdapterError: {
            cause: {
              originalCode: "23505",
              kind: "UniqueConstraintViolation",
              constraint: { index: "RelationshipType_universeId_key_not_deleted_key" },
            },
          },
        },
      });
    });

    it("accepts the same key again once the first type is deleted, and does not list the deleted one", async () => {
      const universe = buildUniverse();
      await universeRepository.add(universe);
      await client.relationshipType.updateMany({
        where: { universeId: universe.id, key: "MEMBER_OF" },
        data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
      });

      await client.relationshipType.create({
        data: {
          universeId: universe.id,
          key: "MEMBER_OF",
          label: "member of",
          inverseLabel: "has member",
          isSymmetric: false,
          isPredefined: true,
        },
      });

      const listedTypes = await relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, universe.id);
      expect(listedTypes.filter((listedType) => listedType.key === "MEMBER_OF")).toHaveLength(1);
      expect(listedTypes).toHaveLength(8);
    });

    it("does not list a deleted type", async () => {
      const universe = buildUniverse();
      await universeRepository.add(universe);
      await client.relationshipType.updateMany({
        where: { universeId: universe.id, key: "ALLY_OF" },
        data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
      });

      const listedTypes = await relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, universe.id);

      expect(listedTypes.map((listedType) => listedType.key)).not.toContain("ALLY_OF");
      expect(listedTypes).toHaveLength(7);
    });

    it("does not list the types of a deleted universe", async () => {
      const universe = buildUniverse();
      await universeRepository.add(universe);
      await client.universe.update({
        where: { id: universe.id },
        data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
      });

      expect(await relationshipTypeRepository.findAllInOwnedUniverse(FIRST_OWNER_ID, universe.id)).toEqual([]);
    });

    it("removes the types with their universe when the owner is deleted", async () => {
      await universeRepository.add(buildUniverse());
      await universeRepository.add(
        buildUniverse({ id: "00000000-0000-4000-8000-0000000000b3", ownerId: SECOND_OWNER_ID }),
      );

      await client.user.delete({ where: { id: FIRST_OWNER_ID } });

      expect(await client.relationshipType.count()).toBe(8);
    });
  });

  describe("storage failures", () => {
    it("turn a failed read into an InfrastructureError that keeps the cause, with no query in its message", async () => {
      const cause = new Error('select * from "RelationshipType" failed');
      const failingRepository = createPrismaRelationshipTypeRepository(() => {
        throw cause;
      });

      const failure = await failingRepository
        .findAllInOwnedUniverse(FIRST_OWNER_ID, buildUniverse().id)
        .catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect((failure as InfrastructureError).cause).toBe(cause);
      expect((failure as InfrastructureError).message).not.toMatch(/select|RelationshipType"/iu);
    });
  });
});
