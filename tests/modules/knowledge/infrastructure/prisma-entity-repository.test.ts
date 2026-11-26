import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaEntityRepository } from "@/modules/knowledge/infrastructure/prisma-entity-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  describeEntityStorageContract,
  SECOND_UNIVERSE_OF_FIRST_OWNER,
  storeWorkWithBoundaries,
} from "../../../support/contracts/entity-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "../../../support/database/postgres-knowledge-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import {
  buildNewEntity,
  buildNewWork,
  buildNumberedTestUnits,
} from "../../../support/knowledge-repository-factories";

describeEntityStorageContract("PostgreSQL", createPostgresKnowledgeStorage);

describe("PostgreSQL entity repository", () => {
  let client: PrismaClient;
  const entityRepository = createPrismaEntityRepository(() => client);

  async function setUp() {
    await client?.$disconnect();
    client = createTestPrismaClient();
    const storage = await createPostgresKnowledgeStorage([
      FIRST_UNIVERSE,
      SECOND_OWNER_UNIVERSE,
      SECOND_UNIVERSE_OF_FIRST_OWNER,
    ]);
    const [firstUnit, secondUnit] = await storeWorkWithBoundaries(
      storage,
      buildNewWork({ units: buildNumberedTestUnits(2) }),
    );
    const [foreignUnit] = await storeWorkWithBoundaries(
      storage,
      buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
    );
    const [otherUniverseUnit] = await storeWorkWithBoundaries(
      storage,
      buildNewWork({ id: "00000000-0000-4000-8000-0000000000a8", universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id }),
    );
    const [unitOfOtherWork] = await storeWorkWithBoundaries(
      storage,
      buildNewWork({ id: "00000000-0000-4000-8000-0000000000a7", title: "Other work" }),
    );
    return { firstUnit, secondUnit, foreignUnit, otherUniverseUnit, unitOfOtherWork };
  }

  let boundaries: Awaited<ReturnType<typeof setUp>>;

  beforeEach(async () => {
    boundaries = await setUp();
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  function entityRowWithBoundary(boundary: { workId: string; unitId: string }) {
    return {
      universeId: FIRST_UNIVERSE.id,
      type: "CHARACTER" as const,
      name: "Written directly",
      normalizedName: "written directly",
      boundaryWorkId: boundary.workId,
      boundaryUnitId: boundary.unitId,
    };
  }

  it("stores the entity with empty attributes", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);

    const storedEntity = await client.entity.findUniqueOrThrow({ where: { id: newEntity.id } });

    expect(storedEntity.attributes).toEqual({});
    expect(storedEntity.normalizedName).toBe("frodo");
  });

  it("stores the fragment in the universe of its entity, with the creation time of its entity", async () => {
    const newEntity = buildNewEntity({
      introducedAt: boundaries.firstUnit,
      firstFragment: {
        id: "00000000-0000-4000-8000-0000000000f1",
        content: "Carries the ring.",
        status: "CONFIRMED",
        revealedAt: boundaries.secondUnit,
      },
    });
    await entityRepository.add(newEntity);

    const storedFragment = await client.knowledgeEntry.findUniqueOrThrow({
      where: { id: "00000000-0000-4000-8000-0000000000f1" },
    });

    expect(storedFragment).toMatchObject({
      universeId: FIRST_UNIVERSE.id,
      entityId: newEntity.id,
      createdAt: newEntity.createdAt,
      updatedAt: newEntity.updatedAt,
    });
  });

  it("does not list a deleted entity, nor name it as a similar entity", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);
    await client.entity.update({ where: { id: newEntity.id }, data: { deletedAt: new Date() } });

    expect(await entityRepository.findAllInUniverse(buildViewerContext())).toEqual([]);
    expect(
      await entityRepository.findOldestNameOfSimilarEntity(buildViewerContext(), "CHARACTER", "frodo"),
    ).toBeNull();
  });

  it("neither finds nor describes a deleted entity", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);
    await client.entity.update({ where: { id: newEntity.id }, data: { deletedAt: new Date() } });

    expect(await entityRepository.findInUniverse(buildViewerContext(), newEntity.id)).toBeNull();
    expect(await entityRepository.findDetailsInUniverse(buildViewerContext(), newEntity.id)).toBeNull();
  });

  it("describes the oldest fragment that is not deleted, and of fragments created at the same instant the lowest identifier", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);
    const sameInstant = new Date("2026-05-01T10:00:00.000Z");
    for (const [fragmentId, content, createdAt] of [
      ["00000000-0000-4000-8000-0000000000f1", "Deleted, oldest.", new Date("2026-04-01T10:00:00.000Z")],
      ["00000000-0000-4000-8000-0000000000f3", "Tied, higher identifier.", sameInstant],
      ["00000000-0000-4000-8000-0000000000f2", "Tied, lower identifier.", sameInstant],
      ["00000000-0000-4000-8000-0000000000f4", "Newest.", new Date("2026-06-01T10:00:00.000Z")],
    ] as const) {
      await client.knowledgeEntry.create({
        data: {
          id: fragmentId,
          universeId: FIRST_UNIVERSE.id,
          entityId: newEntity.id,
          content,
          status: "USER_NOTE",
          boundaryWorkId: boundaries.secondUnit.workId,
          boundaryUnitId: boundaries.secondUnit.unitId,
          createdAt,
        },
      });
    }
    await client.knowledgeEntry.update({
      where: { id: "00000000-0000-4000-8000-0000000000f1" },
      data: { deletedAt: new Date() },
    });

    const entityDetails = await entityRepository.findDetailsInUniverse(buildViewerContext(), newEntity.id);

    expect(entityDetails?.firstFragment).toEqual({
      content: "Tied, lower identifier.",
      status: "USER_NOTE",
      revealedAt: { workId: boundaries.secondUnit.workId, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "2" },
    });
  });

  it.each([
    ["a work of another account's universe", "foreignUnit"],
    ["a work of another universe of the same account", "otherUniverseUnit"],
  ] as const)(
    "refuses by the database an entity written directly with a boundary in %s",
    async (_description, boundaryName) => {
      await expect(
        client.entity.create({ data: entityRowWithBoundary(boundaries[boundaryName]) }),
      ).rejects.toThrow();
      expect(await client.entity.count()).toBe(0);
    },
  );

  it("refuses by the database an entity written directly with a unit of another work", async () => {
    await expect(
      client.entity.create({
        data: entityRowWithBoundary({
          workId: boundaries.firstUnit.workId,
          unitId: boundaries.unitOfOtherWork.unitId,
        }),
      }),
    ).rejects.toThrow();
    expect(await client.entity.count()).toBe(0);
  });

  it("refuses by the database a fragment written directly with a boundary of another universe or a unit of another work", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);

    for (const boundary of [
      boundaries.foreignUnit,
      boundaries.otherUniverseUnit,
      { workId: boundaries.firstUnit.workId, unitId: boundaries.unitOfOtherWork.unitId },
    ]) {
      await expect(
        client.knowledgeEntry.create({
          data: {
            universeId: FIRST_UNIVERSE.id,
            entityId: newEntity.id,
            content: "Written directly.",
            status: "USER_NOTE",
            boundaryWorkId: boundary.workId,
            boundaryUnitId: boundary.unitId,
          },
        }),
      ).rejects.toThrow();
    }
    expect(await client.knowledgeEntry.count()).toBe(0);
  });

  it("refuses by the database a fragment written directly in another universe than its entity", async () => {
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);

    await expect(
      client.knowledgeEntry.create({
        data: {
          universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
          entityId: newEntity.id,
          content: "Written directly.",
          status: "USER_NOTE",
          boundaryWorkId: boundaries.otherUniverseUnit.workId,
          boundaryUnitId: boundaries.otherUniverseUnit.unitId,
        },
      }),
    ).rejects.toThrow();
    expect(await client.knowledgeEntry.count()).toBe(0);
  });

  it("refuses by the database a name over 120 characters and a content over 5000 written directly", async () => {
    await expect(
      client.entity.create({
        data: { ...entityRowWithBoundary(boundaries.firstUnit), name: "a".repeat(121) },
      }),
    ).rejects.toThrow();
    const newEntity = buildNewEntity({ introducedAt: boundaries.firstUnit });
    await entityRepository.add(newEntity);

    await expect(
      client.knowledgeEntry.create({
        data: {
          universeId: FIRST_UNIVERSE.id,
          entityId: newEntity.id,
          content: "a".repeat(5001),
          status: "USER_NOTE",
          boundaryWorkId: boundaries.firstUnit.workId,
          boundaryUnitId: boundaries.firstUnit.unitId,
        },
      }),
    ).rejects.toThrow();
    expect(await client.entity.count()).toBe(1);
    expect(await client.knowledgeEntry.count()).toBe(0);
  });

  it("turns a failure to store into the infrastructure error, with the original failure as its cause", async () => {
    const failingRepository = createPrismaEntityRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    const failure = await failingRepository
      .add(buildNewEntity({ introducedAt: boundaries.firstUnit }))
      .catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).toMatchObject({
      message: "The knowledge storage failed while trying to store an entity with its first fragment.",
      cause: new Error("connection to db-host-7 refused"),
    });
    expect(await client.entity.count()).toBe(0);
  });

  it("turns a failure to read into the infrastructure error", async () => {
    const failingRepository = createPrismaEntityRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    await expect(failingRepository.findAllInUniverse(buildViewerContext())).rejects.toBeInstanceOf(
      InfrastructureError,
    );
    await expect(
      failingRepository.findOldestNameOfSimilarEntity(buildViewerContext(), "CHARACTER", "frodo"),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });

  it("turns a failure to read one entity or its details into the infrastructure error", async () => {
    const failingRepository = createPrismaEntityRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });
    const entityId = "00000000-0000-4000-8000-0000000000d0";

    await expect(failingRepository.findInUniverse(buildViewerContext(), entityId)).rejects.toMatchObject({
      message: "The knowledge storage failed while trying to find an entity.",
    });
    await expect(failingRepository.findDetailsInUniverse(buildViewerContext(), entityId)).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });
});
