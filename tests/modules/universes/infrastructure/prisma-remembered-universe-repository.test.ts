import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaRememberedUniverseRepository } from "@/modules/universes/infrastructure/prisma-remembered-universe-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPostgresUniverseStorage } from "../../../support/database/postgres-universe-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { FIRST_OWNER_ID, SECOND_OWNER_ID } from "../../../support/universe-owners";
import { buildUniverse } from "../../../support/universe-repository-factories";

describe("PostgreSQL remembered universe repository", () => {
  let client: PrismaClient;
  const rememberedUniverseRepository = createPrismaRememberedUniverseRepository(() => client);
  const ownUniverse = buildUniverse({ id: "00000000-0000-4000-8000-000000000001" });
  const otherOwnerUniverse = buildUniverse({
    id: "00000000-0000-4000-8000-000000000002",
    ownerId: SECOND_OWNER_ID,
  });

  beforeEach(async () => {
    await client?.$disconnect();
    client = createTestPrismaClient();
    await createPostgresUniverseStorage([ownUniverse, otherOwnerUniverse]);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("refuses to remember a universe of another owner and stores nothing", async () => {
    const failure = await rememberedUniverseRepository
      .saveRememberedUniverse(FIRST_OWNER_ID, otherOwnerUniverse.id)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect((failure as InfrastructureError).cause).toBeDefined();
    expect(await client.rememberedUniverse.count()).toBe(0);
  });

  it("refuses at the database even a direct insert of a universe of another owner", async () => {
    await expect(
      client.rememberedUniverse.create({
        data: { userId: FIRST_OWNER_ID, universeId: otherOwnerUniverse.id },
      }),
    ).rejects.toMatchObject({
      name: "PrismaClientKnownRequestError",
      code: "P2003",
      meta: {
        driverAdapterError: {
          cause: {
            originalCode: "23503",
            kind: "ForeignKeyConstraintViolation",
            constraint: { index: "RememberedUniverse_universeId_userId_fkey" },
          },
        },
      },
    });
    expect(await client.rememberedUniverse.count()).toBe(0);

    // Control: the same direct insert with the account's own universe is accepted, so the refusal
    // above came from the composite owner key and not from another defect of the row.
    await client.rememberedUniverse.create({
      data: { userId: FIRST_OWNER_ID, universeId: ownUniverse.id },
    });
    expect(await client.rememberedUniverse.count()).toBe(1);
  });

  it("refuses a universe that does not exist", async () => {
    await expect(
      rememberedUniverseRepository.saveRememberedUniverse(
        FIRST_OWNER_ID,
        "00000000-0000-4000-8000-0000000000ff",
      ),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });

  it("keeps one row per account, the last write replacing the previous one", async () => {
    const secondOwnUniverse = buildUniverse({ id: "00000000-0000-4000-8000-000000000003" });
    await client.universe.create({ data: secondOwnUniverse });

    await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, ownUniverse.id);
    await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, secondOwnUniverse.id);

    expect(await client.rememberedUniverse.count()).toBe(1);
    expect(await rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
      secondOwnUniverse.id,
    );
  });

  it("reads a remembered universe that is deleted as none", async () => {
    await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, ownUniverse.id);
    await client.universe.update({
      where: { id: ownUniverse.id },
      data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
    });

    expect(await rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBeNull();
  });

  it("disappears with its universe and with its account", async () => {
    await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, ownUniverse.id);
    await client.universe.delete({ where: { id: ownUniverse.id } });
    expect(await client.rememberedUniverse.count()).toBe(0);

    await client.universe.create({ data: ownUniverse });
    await rememberedUniverseRepository.saveRememberedUniverse(FIRST_OWNER_ID, ownUniverse.id);
    await client.user.delete({ where: { id: FIRST_OWNER_ID } });
    expect(await client.rememberedUniverse.count()).toBe(0);
  });

  it("turns a failed read into an InfrastructureError that keeps the cause", async () => {
    const cause = new Error("connection lost");
    const failingRepository = createPrismaRememberedUniverseRepository(() => {
      throw cause;
    });

    const failure = await failingRepository
      .findRememberedUniverseId(FIRST_OWNER_ID)
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect((failure as InfrastructureError).cause).toBe(cause);
  });
});
