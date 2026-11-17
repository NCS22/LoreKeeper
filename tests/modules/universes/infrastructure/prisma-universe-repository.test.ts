import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { isUniverseNameInUse } from "@/modules/universes/application/is-universe-name-in-use";
import { createPrismaUniverseRepository } from "@/modules/universes/infrastructure/prisma-universe-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { describeUniverseStorageContract } from "../../../support/contracts/universe-repository-contract";
import { createPostgresUniverseStorage } from "../../../support/database/postgres-universe-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "../../../support/universe-owners";
import { buildUniverse } from "../../../support/universe-repository-factories";

describeUniverseStorageContract("PostgreSQL", createPostgresUniverseStorage);

describe("PostgreSQL universe repository", () => {
  let client: PrismaClient;
  const universeRepository = createPrismaUniverseRepository(() => client);

  beforeEach(async () => {
    await client?.$disconnect();
    client = createTestPrismaClient();
    await createPostgresUniverseStorage();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  describe("deleted universes", () => {
    const deletedUniverse = buildUniverse({
      id: "00000000-0000-4000-8000-0000000000d1",
      name: "Deleted universe",
    });

    async function insertDeletedUniverse(): Promise<void> {
      await client.universe.create({
        data: { ...deletedUniverse, deletedAt: new Date("2026-02-02T10:00:00.000Z") },
      });
    }

    it("are not listed", async () => {
      await insertDeletedUniverse();

      expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([]);
    });

    it("are not found by identifier", async () => {
      await insertDeletedUniverse();

      expect(await universeRepository.findOwnedById(FIRST_OWNER_ID, deletedUniverse.id)).toBeNull();
    });

    it("are not counted by the name check", async () => {
      await insertDeletedUniverse();

      expect(
        await isUniverseNameInUse({ universeRepository }, buildActingUser(), "Deleted universe"),
      ).toBe(false);
    });
  });

  describe("length limits of the database", () => {
    async function insertUniverse(name: string, description: string | null): Promise<void> {
      await client.universe.create({
        data: { ownerId: FIRST_OWNER_ID, name, description },
      });
    }

    it("accepts names of 1 and 120 code points, counting an emoji as one", async () => {
      await insertUniverse("A", null);
      await insertUniverse("😀".repeat(120), null);

      expect(await client.universe.count()).toBe(2);
    });

    it("refuses an empty name and a name of 121 code points", async () => {
      await expect(insertUniverse("", null)).rejects.toThrow();
      await expect(insertUniverse("😀".repeat(121), null)).rejects.toThrow();
      expect(await client.universe.count()).toBe(0);
    });

    it("accepts no description and descriptions of 1 and 2000 code points", async () => {
      await insertUniverse("First", null);
      await insertUniverse("Second", "D");
      await insertUniverse("Third", "😀".repeat(2000));

      expect(await client.universe.count()).toBe(3);
    });

    it("refuses an empty description and one of 2001 code points", async () => {
      await expect(insertUniverse("First", "")).rejects.toThrow();
      await expect(insertUniverse("Second", "😀".repeat(2001))).rejects.toThrow();
      expect(await client.universe.count()).toBe(0);
    });

    it("refuses a universe whose owner does not exist", async () => {
      await expect(
        client.universe.create({
          data: { ownerId: "10000000-0000-4000-8000-0000000000ff", name: "Orphan" },
        }),
      ).rejects.toThrow();
    });
  });

  describe("storage failures", () => {
    it("turn a failed write into an InfrastructureError that keeps the cause", async () => {
      const universe = buildUniverse();
      await universeRepository.add(universe);

      const failure = await universeRepository.add(universe).catch((error: unknown) => error);

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect((failure as InfrastructureError).cause).toBeDefined();
    });

    it("turn a failed read into an InfrastructureError that keeps the cause", async () => {
      const cause = new Error("connection lost");
      const failingRepository = createPrismaUniverseRepository(() => {
        throw cause;
      });

      for (const read of [
        failingRepository.findAllOwnedBy(FIRST_OWNER_ID),
        failingRepository.findOwnedById(FIRST_OWNER_ID, buildUniverse().id),
      ]) {
        const failure = await read.catch((error: unknown) => error);
        expect(failure).toBeInstanceOf(InfrastructureError);
        expect((failure as InfrastructureError).cause).toBe(cause);
      }
    });

    it("never put the original message or a query in the message of the error", async () => {
      const failingRepository = createPrismaUniverseRepository(() => {
        throw new Error('select * from "Universe" failed');
      });

      const failure = await failingRepository
        .findAllOwnedBy(SECOND_OWNER_ID)
        .catch((error: unknown) => error);

      expect((failure as InfrastructureError).message).not.toMatch(/select|Universe"/i);
    });
  });
});
