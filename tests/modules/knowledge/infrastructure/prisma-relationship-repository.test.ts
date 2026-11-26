import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaRelationshipRepository } from "@/modules/knowledge/infrastructure/prisma-relationship-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { SECOND_UNIVERSE_OF_FIRST_OWNER } from "../../../support/contracts/entity-repository-contract";
import {
  describeRelationshipStorageContract,
  FELLOWSHIP_ID,
  FOREIGN_ENTITY_ID,
  FRODO_ID,
  OTHER_UNIVERSE_ENTITY_ID,
  OWN_WORK_ID,
  SAM_ID,
  storeRelationshipWorld,
} from "../../../support/contracts/relationship-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "../../../support/database/postgres-knowledge-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { buildNewRelationship } from "../../../support/knowledge-repository-factories";

describeRelationshipStorageContract("PostgreSQL", createPostgresKnowledgeStorage);

describe("PostgreSQL relationship repository", () => {
  let client: PrismaClient;
  const relationshipRepository = createPrismaRelationshipRepository(() => client);

  async function setUp() {
    await client?.$disconnect();
    client = createTestPrismaClient();
    const storage = await createPostgresKnowledgeStorage([
      FIRST_UNIVERSE,
      SECOND_OWNER_UNIVERSE,
      SECOND_UNIVERSE_OF_FIRST_OWNER,
    ]);
    return storeRelationshipWorld(storage);
  }

  let world: Awaited<ReturnType<typeof setUp>>;

  beforeEach(async () => {
    world = await setUp();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  /** A valid row of the first universe, written directly, with what a test changes in it. */
  function relationshipRow(overrides: Partial<Record<string, string>> = {}) {
    return {
      universeId: FIRST_UNIVERSE.id,
      relationshipTypeId: world.memberOfTypeId,
      sourceEntityId: FRODO_ID,
      targetEntityId: FELLOWSHIP_ID,
      status: "USER_NOTE" as const,
      boundaryWorkId: world.firstUnit.workId,
      boundaryUnitId: world.firstUnit.unitId,
      ...overrides,
    };
  }

  it("accepts a valid row written directly, so the refusals below come from what each one changes", async () => {
    await client.relationship.create({ data: relationshipRow() });

    expect(await client.relationship.count()).toBe(1);
  });

  it("stores the relationship once, in its universe, with its type, status and boundary", async () => {
    const newRelationship = buildNewRelationship({
      sourceEntityId: FRODO_ID,
      targetEntityId: FELLOWSHIP_ID,
      relationshipTypeId: world.memberOfTypeId,
      status: "SPECULATION",
      revealedAt: world.thirdUnit,
    });

    await relationshipRepository.add(newRelationship);

    expect(await client.relationship.findMany()).toEqual([
      {
        id: newRelationship.id,
        universeId: FIRST_UNIVERSE.id,
        relationshipTypeId: world.memberOfTypeId,
        sourceEntityId: FRODO_ID,
        targetEntityId: FELLOWSHIP_ID,
        status: "SPECULATION",
        boundaryWorkId: world.thirdUnit.workId,
        boundaryUnitId: world.thirdUnit.unitId,
        createdAt: newRelationship.createdAt,
        updatedAt: newRelationship.updatedAt,
        deletedAt: null,
      },
    ]);
  });

  it("refuses by the database a relationship written directly from an entity to itself", async () => {
    await expect(
      client.relationship.create({ data: relationshipRow({ targetEntityId: FRODO_ID }) }),
    ).rejects.toThrow();
    expect(await client.relationship.count()).toBe(0);
  });

  it.each([
    ["a source of another account's universe", { sourceEntityId: FOREIGN_ENTITY_ID }],
    ["a target of another account's universe", { targetEntityId: FOREIGN_ENTITY_ID }],
    ["a source of another universe of the same account", { sourceEntityId: OTHER_UNIVERSE_ENTITY_ID }],
    ["a target of another universe of the same account", { targetEntityId: OTHER_UNIVERSE_ENTITY_ID }],
  ])("refuses by the database a relationship written directly with %s", async (_description, entityOverride) => {
    await expect(client.relationship.create({ data: relationshipRow(entityOverride) })).rejects.toThrow();
    expect(await client.relationship.count()).toBe(0);
  });

  it("refuses by the database a relationship written directly with a type of another universe", async () => {
    for (const relationshipTypeId of [world.foreignMemberOfTypeId, world.otherUniverseMemberOfTypeId]) {
      await expect(
        client.relationship.create({ data: relationshipRow({ relationshipTypeId }) }),
      ).rejects.toThrow();
    }
    expect(await client.relationship.count()).toBe(0);
  });

  it("refuses by the database a relationship written directly with a boundary of another universe or a unit of another work", async () => {
    const badBoundaries: SpoilerBoundary[] = [
      world.foreignUnits[0] as SpoilerBoundary,
      world.otherUniverseUnits[0] as SpoilerBoundary,
      { workId: OWN_WORK_ID, unitId: (world.secondWorkUnits[0] as SpoilerBoundary).unitId },
    ];

    for (const badBoundary of badBoundaries) {
      await expect(
        client.relationship.create({
          data: relationshipRow({ boundaryWorkId: badBoundary.workId, boundaryUnitId: badBoundary.unitId }),
        }),
      ).rejects.toThrow();
    }
    expect(await client.relationship.count()).toBe(0);
  });

  it("refuses by the database a relationship written directly in another universe than its entities", async () => {
    await expect(
      client.relationship.create({
        data: relationshipRow({
          universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
          relationshipTypeId: world.otherUniverseMemberOfTypeId,
          boundaryWorkId: (world.otherUniverseUnits[0] as SpoilerBoundary).workId,
          boundaryUnitId: (world.otherUniverseUnits[0] as SpoilerBoundary).unitId,
        }),
      }),
    ).rejects.toThrow();
    expect(await client.relationship.count()).toBe(0);
  });

  it("does not list a deleted relationship, nor one whose other entity is deleted", async () => {
    await relationshipRepository.add(
      buildNewRelationship({
        id: "00000000-0000-4000-8000-0000000000c1",
        sourceEntityId: FRODO_ID,
        targetEntityId: FELLOWSHIP_ID,
        relationshipTypeId: world.memberOfTypeId,
        revealedAt: world.firstUnit,
      }),
    );
    await relationshipRepository.add(
      buildNewRelationship({
        id: "00000000-0000-4000-8000-0000000000c2",
        sourceEntityId: SAM_ID,
        targetEntityId: FRODO_ID,
        relationshipTypeId: world.allyOfTypeId,
        revealedAt: world.firstUnit,
      }),
    );
    await relationshipRepository.add(
      buildNewRelationship({
        id: "00000000-0000-4000-8000-0000000000c3",
        sourceEntityId: FRODO_ID,
        targetEntityId: SAM_ID,
        relationshipTypeId: world.allyOfTypeId,
        revealedAt: world.firstUnit,
      }),
    );
    await client.relationship.update({
      where: { id: "00000000-0000-4000-8000-0000000000c1" },
      data: { deletedAt: new Date() },
    });

    expect(
      (await relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID)).map((relationship) => relationship.id),
    ).toEqual(["00000000-0000-4000-8000-0000000000c2", "00000000-0000-4000-8000-0000000000c3"]);

    await client.entity.update({ where: { id: SAM_ID }, data: { deletedAt: new Date() } });

    expect(await relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID)).toEqual([]);
  });

  it("turns a failure to store into the infrastructure error, with the original failure as its cause", async () => {
    const failingRepository = createPrismaRelationshipRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    const failure = await failingRepository
      .add(
        buildNewRelationship({
          sourceEntityId: FRODO_ID,
          targetEntityId: FELLOWSHIP_ID,
          relationshipTypeId: world.memberOfTypeId,
          revealedAt: world.firstUnit,
        }),
      )
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).toMatchObject({
      message: "The knowledge storage failed while trying to store a relationship.",
      cause: new Error("connection to db-host-7 refused"),
    });
    expect(await client.relationship.count()).toBe(0);
  });

  it("turns a failure to read into the infrastructure error", async () => {
    const failingRepository = createPrismaRelationshipRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    await expect(failingRepository.findAllOfEntity(buildViewerContext(), FRODO_ID)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });
});
