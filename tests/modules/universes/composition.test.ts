import { describe, expect, it } from "vitest";
import { createUniversesInMemory } from "@/modules/universes/composition";
import type { UniverseDto } from "@/modules/universes/application/universe-dto";

const firstStartingUniverse: UniverseDto = {
  id: "universe-1",
  name: "First universe",
  description: null,
  mode: "AUTHOR",
  createdAt: "2026-01-01T10:00:00.000Z",
  updatedAt: "2026-01-02T10:00:00.000Z",
};

const secondStartingUniverse: UniverseDto = {
  id: "universe-2",
  name: "Second universe",
  description: "Line one\nLine two",
  mode: "READER",
  createdAt: "2026-02-01T10:00:00.000Z",
  updatedAt: "2026-02-01T10:00:00.000Z",
};

describe("createUniversesInMemory", () => {
  it("lists nothing when there are no starting universes", async () => {
    const universesModule = createUniversesInMemory();

    expect(await universesModule.listUniverses()).toEqual([]);
  });

  it("lists the starting universes unchanged and in order", async () => {
    const universesModule = createUniversesInMemory([firstStartingUniverse, secondStartingUniverse]);

    expect(await universesModule.listUniverses()).toEqual([
      firstStartingUniverse,
      secondStartingUniverse,
    ]);
  });

  it("lists a created universe last and keeps the starting ones", async () => {
    const universesModule = createUniversesInMemory([firstStartingUniverse, secondStartingUniverse]);

    const createdUniverse = await universesModule.createUniverse({
      name: "Third universe",
      description: null,
      mode: "READER",
    });

    expect(createdUniverse.id).not.toBe(firstStartingUniverse.id);
    expect(createdUniverse.id).not.toBe(secondStartingUniverse.id);
    expect(await universesModule.listUniverses()).toEqual([
      firstStartingUniverse,
      secondStartingUniverse,
      createdUniverse,
    ]);
  });

  it("does not share data between two compositions", async () => {
    const firstModule = createUniversesInMemory([firstStartingUniverse]);
    const secondModule = createUniversesInMemory([firstStartingUniverse]);

    await firstModule.createUniverse({ name: "Only in the first", description: null, mode: "READER" });

    expect(await firstModule.listUniverses()).toHaveLength(2);
    expect(await secondModule.listUniverses()).toEqual([firstStartingUniverse]);
    expect(await secondModule.isUniverseNameInUse("Only in the first")).toBe(false);
  });

  it("detects a name already used by a starting or a created universe", async () => {
    const universesModule = createUniversesInMemory([firstStartingUniverse]);

    expect(await universesModule.isUniverseNameInUse("  FIRST   universe ")).toBe(true);
    expect(await universesModule.isUniverseNameInUse("Brand new")).toBe(false);

    await universesModule.createUniverse({ name: "Brand new", description: null, mode: "AUTHOR" });

    expect(await universesModule.isUniverseNameInUse("brand NEW")).toBe(true);
  });
});
