import { Client } from "pg";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { createPrismaRememberedUniverseRepository } from "@/modules/universes/infrastructure/prisma-remembered-universe-repository";
import { createPrismaUniverseRepository } from "@/modules/universes/infrastructure/prisma-universe-repository";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  createTestPrismaClient,
  emptyAuthenticationTables,
  requireTestDatabaseUrl,
} from "../../../support/database/test-database";
import { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "../../../support/universe-owners";
import { buildUniverse } from "../../../support/universe-repository-factories";

// Its own file: terminating every backend connection would break the client other files share.
describe("persistence of universes (FR-6)", () => {
  let applicationClient: PrismaClient;
  let freshClient: PrismaClient | null = null;

  beforeAll(() => {
    applicationClient = createTestPrismaClient();
  });

  afterAll(async () => {
    await applicationClient.$disconnect();
    await freshClient?.$disconnect();
  });

  async function terminateEveryOtherConnection(): Promise<void> {
    const terminatingConnection = new Client({ connectionString: requireTestDatabaseUrl() });
    await terminatingConnection.connect();
    try {
      await terminatingConnection.query(
        "SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname = current_database() AND pid <> pg_backend_pid()",
      );
    } finally {
      await terminatingConnection.end();
    }
  }

  it("reads back, with a new client, what was written before every connection was lost", async () => {
    await emptyAuthenticationTables(applicationClient);
    await applicationClient.user.createMany({
      data: [FIRST_OWNER_ID, SECOND_OWNER_ID].map((ownerId) => ({
        id: ownerId,
        name: buildActingUser(ownerId).displayName,
        email: buildActingUser(ownerId).email,
      })),
    });
    const storedUniverse = buildUniverse({
      description: "Line one\nLine two",
      mode: "AUTHOR",
      createdAt: new Date("2026-04-05T06:07:08.123Z"),
      updatedAt: new Date("2026-04-05T06:07:08.123Z"),
    });
    await createPrismaUniverseRepository(() => applicationClient).add(storedUniverse);
    await createPrismaRememberedUniverseRepository(() => applicationClient).saveRememberedUniverse(
      FIRST_OWNER_ID,
      storedUniverse.id,
    );

    await applicationClient.$disconnect();
    await terminateEveryOtherConnection();
    const clientAfterTheLoss = createTestPrismaClient();
    freshClient = clientAfterTheLoss;

    expect(
      await createPrismaUniverseRepository(() => clientAfterTheLoss).findAllOwnedBy(FIRST_OWNER_ID),
    ).toEqual([storedUniverse]);
    expect(
      await createPrismaRememberedUniverseRepository(
        () => clientAfterTheLoss,
      ).findRememberedUniverseId(FIRST_OWNER_ID),
    ).toBe(storedUniverse.id);
  });
});
