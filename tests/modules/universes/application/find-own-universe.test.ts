import { afterAll, describe, expect, it } from "vitest";
import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import { ValidationError } from "@/shared/domain/validation-error";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPostgresUniverseStorage } from "../../../support/database/postgres-universe-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

const OWN_UNIVERSE_ID = "00000000-0000-4000-8000-000000000001";
const FOREIGN_UNIVERSE_ID = "00000000-0000-4000-8000-000000000003";
const NONEXISTENT_UNIVERSE_ID = "00000000-0000-4000-8000-0000000000ff";

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(universeStorageFactories)("findOwnUniverse: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  const otherActor = buildActingUser(SECOND_OWNER_ID);
  const ownUniverse = buildUniverse({ id: OWN_UNIVERSE_ID, name: "Own universe", mode: "AUTHOR" });
  const foreignUniverse = buildUniverse({
    id: FOREIGN_UNIVERSE_ID,
    ownerId: SECOND_OWNER_ID,
    name: "Foreign universe",
  });

  async function setUp() {
    return createStorage([ownUniverse, foreignUniverse]);
  }

  it("finds an own universe and returns its DTO, without the owner", async () => {
    const storage = await setUp();

    expect(await findOwnUniverse(storage, actor, OWN_UNIVERSE_ID)).toEqual({
      id: OWN_UNIVERSE_ID,
      name: "Own universe",
      description: null,
      mode: "AUTHOR",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-01-01T10:00:00.000Z",
    });
  });

  it("accepts the identifier in upper case", async () => {
    const storage = await setUp();

    const foundUniverse = await findOwnUniverse(storage, actor, OWN_UNIVERSE_ID.toUpperCase());

    expect(foundUniverse?.id).toBe(OWN_UNIVERSE_ID);
  });

  it("answers null alike for a universe of another account and for a nonexistent one", async () => {
    const storage = await setUp();

    expect(await findOwnUniverse(storage, actor, FOREIGN_UNIVERSE_ID)).toBeNull();
    expect(await findOwnUniverse(storage, actor, NONEXISTENT_UNIVERSE_ID)).toBeNull();
  });

  it("lets each account find only its own universe", async () => {
    const storage = await setUp();

    expect((await findOwnUniverse(storage, otherActor, FOREIGN_UNIVERSE_ID))?.id).toBe(
      FOREIGN_UNIVERSE_ID,
    );
    expect(await findOwnUniverse(storage, otherActor, OWN_UNIVERSE_ID)).toBeNull();
  });

  it.each(["", "   ", "not-a-uuid", `${OWN_UNIVERSE_ID}0`])(
    "rejects the identifier %j as a validation error on universeId",
    async (universeId) => {
      const storage = await setUp();

      const error = await captureRejection(findOwnUniverse(storage, actor, universeId));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }] });
    },
  );
});

describe("findOwnUniverse: a deleted universe in PostgreSQL", () => {
  let client: PrismaClient | null = null;

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("answers null, as for a nonexistent universe", async () => {
    const storage = await createPostgresUniverseStorage([buildUniverse({ id: OWN_UNIVERSE_ID })]);
    client = createTestPrismaClient();
    await client.universe.update({
      where: { id: OWN_UNIVERSE_ID },
      data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
    });

    expect(await findOwnUniverse(storage, buildActingUser(FIRST_OWNER_ID), OWN_UNIVERSE_ID)).toBeNull();
  });
});
