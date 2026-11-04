import { describe, expect, it } from "vitest";
import type { Universe } from "@/modules/universes/domain/universe";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";
import { createInMemoryUniverseRepository } from "@/modules/universes/infrastructure/in-memory-universe-repository";
import { createFakeUniverseRepository } from "../../../support/fakes/fake-universe-repository";

function buildUniverse(overrides: Partial<Universe> = {}): Universe {
  return {
    id: "universe-1",
    name: "First universe",
    description: null,
    mode: "READER",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}

const repositoryFactories: ReadonlyArray<
  readonly [string, (startingUniverses?: readonly Universe[]) => UniverseRepository]
> = [
  ["in-memory repository", createInMemoryUniverseRepository],
  ["fake repository", createFakeUniverseRepository],
];

describe.each(repositoryFactories)("universe repository contract: %s", (_name, createRepository) => {
  const firstUniverse = buildUniverse({ id: "universe-1", name: "First universe" });
  const secondUniverse = buildUniverse({
    id: "universe-2",
    name: "Second universe",
    description: "Line one\nLine two",
    mode: "AUTHOR",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  });
  const thirdUniverse = buildUniverse({ id: "universe-3", name: "Third universe" });

  it("lists nothing when it starts empty", async () => {
    expect(await createRepository().findAll()).toEqual([]);
  });

  it("lists the starting universes in the order they were given", async () => {
    const repository = createRepository([secondUniverse, firstUniverse]);

    expect(await repository.findAll()).toEqual([secondUniverse, firstUniverse]);
  });

  it("lists an added universe after the existing ones", async () => {
    const repository = createRepository([firstUniverse]);

    await repository.add(secondUniverse);
    await repository.add(thirdUniverse);

    expect(await repository.findAll()).toEqual([firstUniverse, secondUniverse, thirdUniverse]);
  });

  it("returns every field of an added universe unchanged", async () => {
    const repository = createRepository();

    await repository.add(secondUniverse);

    expect(await repository.findAll()).toEqual([secondUniverse]);
  });

  it("does not change the other universes when one is added", async () => {
    const repository = createRepository([firstUniverse]);
    const universesBeforeAdding = await repository.findAll();

    await repository.add(secondUniverse);

    const universesAfterAdding = await repository.findAll();
    expect(universesAfterAdding.slice(0, universesBeforeAdding.length)).toEqual(
      universesBeforeAdding,
    );
  });

  it("does not let the returned list alter the stored universes", async () => {
    const repository = createRepository([firstUniverse]);

    const returnedUniverses = [...(await repository.findAll())];
    returnedUniverses.pop();
    returnedUniverses.push(secondUniverse);

    expect(await repository.findAll()).toEqual([firstUniverse]);
  });

  it("does not let a returned date alter the stored universes", async () => {
    const repository = createRepository([firstUniverse]);

    const [returnedUniverse] = await repository.findAll();
    returnedUniverse?.createdAt.setUTCFullYear(1999);
    returnedUniverse?.updatedAt.setUTCFullYear(1999);

    expect(await repository.findAll()).toEqual([firstUniverse]);
  });

  it("does not let the caller alter a stored universe through the object it added", async () => {
    const repository = createRepository();
    const universeToAdd = buildUniverse();

    await repository.add(universeToAdd);
    universeToAdd.createdAt.setUTCFullYear(1999);

    expect(await repository.findAll()).toEqual([buildUniverse()]);
  });

  it("does not let the caller alter a stored universe through the starting universes", async () => {
    const startingUniverse = buildUniverse();
    const repository = createRepository([startingUniverse]);

    startingUniverse.updatedAt.setUTCFullYear(1999);

    expect(await repository.findAll()).toEqual([buildUniverse()]);
  });

  it("keeps two repositories independent", async () => {
    const firstRepository = createRepository();
    const secondRepository = createRepository();

    await firstRepository.add(firstUniverse);

    expect(await secondRepository.findAll()).toEqual([]);
  });
});
