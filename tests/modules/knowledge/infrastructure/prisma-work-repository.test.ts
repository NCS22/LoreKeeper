import { afterAll, beforeEach, describe, expect, it } from "vitest";
import { createPrismaWorkRepository } from "@/modules/knowledge/infrastructure/prisma-work-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  buildViewerContext,
  describeWorkStorageContract,
  FIRST_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "../../../support/database/postgres-knowledge-storage";
import { createTestPrismaClient } from "../../../support/database/test-database";
import { buildNewWork, buildNumberedTestUnits } from "../../../support/knowledge-repository-factories";

describeWorkStorageContract("PostgreSQL", createPostgresKnowledgeStorage);

describe("PostgreSQL work repository", () => {
  let client: PrismaClient;
  const workRepository = createPrismaWorkRepository(() => client);

  beforeEach(async () => {
    await client?.$disconnect();
    client = createTestPrismaClient();
    await createPostgresKnowledgeStorage([FIRST_UNIVERSE]);
  });

  afterAll(async () => {
    await client.$disconnect();
  });

  it("does not list a deleted work", async () => {
    const newWork = buildNewWork();
    await workRepository.add(newWork);
    await client.work.update({ where: { id: newWork.id }, data: { deletedAt: new Date() } });

    expect(await workRepository.findAllInUniverse(buildViewerContext())).toEqual([]);
  });

  it("does not count a deleted unit", async () => {
    const newWork = buildNewWork({ units: buildNumberedTestUnits(3) });
    await workRepository.add(newWork);
    await client.narrativeUnit.updateMany({
      where: { workId: newWork.id, label: "3" },
      data: { deletedAt: new Date() },
    });

    const [listedWork] = await workRepository.findAllInUniverse(buildViewerContext());

    expect(listedWork?.unitCount).toBe(2);
  });

  it("stores the units with the creation time of their work", async () => {
    const newWork = buildNewWork({ units: buildNumberedTestUnits(2) });
    await workRepository.add(newWork);

    const storedUnits = await client.narrativeUnit.findMany({ where: { workId: newWork.id } });

    expect(storedUnits.map((unit) => unit.createdAt)).toEqual([newWork.createdAt, newWork.createdAt]);
  });

  it("refuses by the database a title over 200 characters written directly", async () => {
    await expect(
      client.work.create({
        data: { universeId: FIRST_UNIVERSE.id, title: "a".repeat(201), medium: "NOVEL" },
      }),
    ).rejects.toThrow();
    expect(await client.work.count()).toBe(0);
  });

  it("refuses by the database two units of one work with the same ordinal", async () => {
    const newWork = buildNewWork();
    await workRepository.add(newWork);

    await expect(
      client.narrativeUnit.create({ data: { workId: newWork.id, ordinal: 1000, label: "again" } }),
    ).rejects.toThrow();
  });

  it("turns a failure to store into the infrastructure error, with the original failure as its cause, and stores nothing", async () => {
    const failingRepository = createPrismaWorkRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    const failure = await failingRepository.add(buildNewWork()).catch((error: unknown) => error);

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).toMatchObject({
      message: "The knowledge storage failed while trying to store a work with its units.",
      cause: new Error("connection to db-host-7 refused"),
    });
    expect(await client.work.count()).toBe(0);
  });

  it("turns a failure to read into the infrastructure error", async () => {
    const failingRepository = createPrismaWorkRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    await expect(failingRepository.findAllInUniverse(buildViewerContext())).rejects.toBeInstanceOf(
      InfrastructureError,
    );
  });

  it("finds no boundary in a deleted work, nor for a deleted unit", async () => {
    const newWork = buildNewWork({ units: buildNumberedTestUnits(2) });
    await workRepository.add(newWork);
    await client.narrativeUnit.updateMany({
      where: { workId: newWork.id, label: "2" },
      data: { deletedAt: new Date() },
    });

    expect(await workRepository.findBoundaryOfUnitNumber(buildViewerContext(), newWork.id, 2)).toBeNull();
    expect(await workRepository.findBoundaryOfUnitNumber(buildViewerContext(), newWork.id, 1)).not.toBeNull();

    await client.work.update({ where: { id: newWork.id }, data: { deletedAt: new Date() } });

    expect(await workRepository.findBoundaryOfUnitNumber(buildViewerContext(), newWork.id, 1)).toBeNull();
  });

  it("turns a failure to find a unit into the infrastructure error", async () => {
    const failingRepository = createPrismaWorkRepository(() => {
      throw new Error("connection to db-host-7 refused");
    });

    await expect(
      failingRepository.findBoundaryOfUnitNumber(buildViewerContext(), buildNewWork().id, 1),
    ).rejects.toBeInstanceOf(InfrastructureError);
  });

  it("refuses a work in a universe that does not exist", async () => {
    await expect(
      workRepository.add(buildNewWork({ universeId: "00000000-0000-4000-8000-0000000000ff" })),
    ).rejects.toBeInstanceOf(InfrastructureError);
    expect(await client.work.count()).toBe(0);
  });
});
