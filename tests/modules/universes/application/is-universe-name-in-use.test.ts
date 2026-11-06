import { describe, expect, it } from "vitest";
import { isUniverseNameInUse } from "@/modules/universes/application/is-universe-name-in-use";
import { buildUniverse, universeRepositoryFactories } from "../../../support/universe-repository-factories";

describe.each(universeRepositoryFactories)("isUniverseNameInUse: %s", (_name, createRepository) => {
  function setUp() {
    const universeRepository = createRepository([
      buildUniverse({ id: "universe-1", name: "Crónicas de Hielo" }),
      buildUniverse({ id: "universe-2", name: "Second universe" }),
    ]);
    return { universeRepository };
  }

  it("finds an identical name", async () => {
    expect(await isUniverseNameInUse(setUp(), "Second universe")).toBe(true);
  });

  it("ignores letter case", async () => {
    expect(await isUniverseNameInUse(setUp(), "SECOND UNIVERSE")).toBe(true);
  });

  it("ignores accents in either direction", async () => {
    expect(await isUniverseNameInUse(setUp(), "Cronicas de Hielo")).toBe(true);
    expect(await isUniverseNameInUse(setUp(), "crÓnicas dé hielo")).toBe(true);
  });

  it("ignores surrounding and repeated whitespace", async () => {
    expect(await isUniverseNameInUse(setUp(), "  Second    universe  ")).toBe(true);
  });

  it("finds no match for a different name", async () => {
    expect(await isUniverseNameInUse(setUp(), "Third universe")).toBe(false);
    expect(await isUniverseNameInUse(setUp(), "Second")).toBe(false);
  });

  it.each(["", "   ", "\n\t "])("returns false for the empty name %j", async (rawName) => {
    expect(await isUniverseNameInUse(setUp(), rawName)).toBe(false);
  });

  it("returns false when there are no universes", async () => {
    const universeRepository = createRepository();

    expect(await isUniverseNameInUse({ universeRepository }, "Anything")).toBe(false);
  });

  it("returns false again once the name changes to one that does not match", async () => {
    const dependencies = setUp();

    expect(await isUniverseNameInUse(dependencies, "Second universe")).toBe(true);
    expect(await isUniverseNameInUse(dependencies, "Second universe 2")).toBe(false);
  });
});
