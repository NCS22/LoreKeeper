import { afterAll, describe, expect, it } from "vitest";
import { listRelationshipTypes } from "@/modules/universes/application/list-relationship-types";
import { UniverseNotFoundError } from "@/modules/universes/domain/universe-errors";
import { ValidationError } from "@/shared/domain/validation-error";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { EXPECTED_PREDEFINED_RELATIONSHIP_TYPES } from "../../../support/contracts/universe-repository-contract";
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

// What the screens receive: no universe, no "predefined" flag (every type is predefined today).
const EXPECTED_RELATIONSHIP_TYPE_DTO_VALUES = EXPECTED_PREDEFINED_RELATIONSHIP_TYPES.map(
  ({ key, label, inverseLabel, isSymmetric }) => ({ key, label, inverseLabel, isSymmetric }),
);

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(universeStorageFactories)("listRelationshipTypes: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  const otherActor = buildActingUser(SECOND_OWNER_ID);

  async function setUp() {
    return createStorage([
      buildUniverse({ id: OWN_UNIVERSE_ID, name: "Own universe" }),
      buildUniverse({ id: FOREIGN_UNIVERSE_ID, ownerId: SECOND_OWNER_ID, name: "Foreign universe" }),
    ]);
  }

  it("lists the eight predefined types of an own universe, ordered by key, as DTOs", async () => {
    const storage = await setUp();

    const relationshipTypes = await listRelationshipTypes(storage, actor, OWN_UNIVERSE_ID);

    expect(
      relationshipTypes.map(({ key, label, inverseLabel, isSymmetric }) => ({
        key,
        label,
        inverseLabel,
        isSymmetric,
      })),
    ).toEqual(EXPECTED_RELATIONSHIP_TYPE_DTO_VALUES);
    for (const relationshipType of relationshipTypes) {
      expect(Object.keys(relationshipType).sort()).toEqual([
        "id",
        "inverseLabel",
        "isSymmetric",
        "key",
        "label",
      ]);
    }
  });

  it("gives the same not found error for a universe of another account and for a nonexistent one", async () => {
    const storage = await setUp();

    const foreignError = await captureRejection(listRelationshipTypes(storage, actor, FOREIGN_UNIVERSE_ID));
    const nonexistentError = await captureRejection(
      listRelationshipTypes(storage, actor, NONEXISTENT_UNIVERSE_ID),
    );

    expect(foreignError).toBeInstanceOf(UniverseNotFoundError);
    expect(nonexistentError).toBeInstanceOf(UniverseNotFoundError);
    expect(foreignError).toEqual(nonexistentError);
    expect(foreignError).toMatchObject({ message: "The universe was not found.", code: "NOT_FOUND" });
  });

  it("never lists the types of another account, and each account lists its own", async () => {
    const storage = await setUp();

    const ownTypes = await listRelationshipTypes(storage, actor, OWN_UNIVERSE_ID);
    const typesOfTheOther = await listRelationshipTypes(storage, otherActor, FOREIGN_UNIVERSE_ID);
    const refusalOfTheOther = await captureRejection(
      listRelationshipTypes(storage, otherActor, OWN_UNIVERSE_ID),
    );

    expect(refusalOfTheOther).toBeInstanceOf(UniverseNotFoundError);
    expect(typesOfTheOther).toHaveLength(8);
    const ownTypeIds = new Set(ownTypes.map((relationshipType) => relationshipType.id));
    expect(typesOfTheOther.some((relationshipType) => ownTypeIds.has(relationshipType.id))).toBe(false);
  });

  it.each(["", "   ", "not-a-uuid"])(
    "rejects the identifier %j as a validation error on universeId",
    async (universeId) => {
      const storage = await setUp();

      const error = await captureRejection(listRelationshipTypes(storage, actor, universeId));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({ issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }] });
    },
  );
});

describe("listRelationshipTypes: a deleted universe in PostgreSQL", () => {
  let client: PrismaClient | null = null;

  afterAll(async () => {
    await client?.$disconnect();
  });

  it("gives the not found error, as for a nonexistent universe", async () => {
    const storage = await createPostgresUniverseStorage([buildUniverse({ id: OWN_UNIVERSE_ID })]);
    client = createTestPrismaClient();
    await client.universe.update({
      where: { id: OWN_UNIVERSE_ID },
      data: { deletedAt: new Date("2026-02-02T10:00:00.000Z") },
    });

    const error = await captureRejection(
      listRelationshipTypes(storage, buildActingUser(FIRST_OWNER_ID), OWN_UNIVERSE_ID),
    );

    expect(error).toBeInstanceOf(UniverseNotFoundError);
  });
});
