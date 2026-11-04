import { describe, expect, it } from "vitest";
import { createUniverse } from "@/modules/universes/application/create-universe";
import { listUniverses } from "@/modules/universes/application/list-universes";
import { toUniverseDto } from "@/modules/universes/application/universe-dto";
import { buildUniverse, universeRepositoryFactories } from "../../../support/universe-repository-factories";

describe.each(universeRepositoryFactories)("listUniverses: %s", (_name, createRepository) => {
  const firstUniverse = buildUniverse({ id: "universe-1", name: "First universe" });
  const secondUniverse = buildUniverse({
    id: "universe-2",
    name: "Second universe",
    mode: "AUTHOR",
    description: "Line one\nLine two",
    createdAt: new Date("2026-02-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  });

  it("lists nothing when there are no universes", async () => {
    const universeRepository = createRepository();

    expect(await listUniverses({ universeRepository })).toEqual([]);
  });

  it("lists the existing universes as DTOs in creation order", async () => {
    const universeRepository = createRepository([firstUniverse, secondUniverse]);

    expect(await listUniverses({ universeRepository })).toEqual([
      toUniverseDto(firstUniverse),
      toUniverseDto(secondUniverse),
    ]);
  });

  it("lists a newly created universe last and leaves the existing ones intact", async () => {
    const universeRepository = createRepository([firstUniverse, secondUniverse]);

    const createdUniverse = await createUniverse(
      {
        universeRepository,
        generateUniverseId: () => "universe-3",
        getCurrentTime: () => new Date("2026-03-01T10:00:00.000Z"),
      },
      { name: "Third universe", description: null, mode: "READER" },
    );

    expect(await listUniverses({ universeRepository })).toEqual([
      toUniverseDto(firstUniverse),
      toUniverseDto(secondUniverse),
      createdUniverse,
    ]);
  });
});
