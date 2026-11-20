import { describe, expect, it } from "vitest";
import { isUniverseNameInUse } from "@/modules/universes/application/is-universe-name-in-use";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

describe.each(universeStorageFactories)("isUniverseNameInUse: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);

  async function setUp() {
    const { universeRepository } = await createStorage([
      buildUniverse({ id: "00000000-0000-4000-8000-000000000001", name: "Crónicas de Hielo" }),
      buildUniverse({ id: "00000000-0000-4000-8000-000000000002", name: "Second universe" }),
      buildUniverse({
        id: "00000000-0000-4000-8000-000000000003",
        ownerId: SECOND_OWNER_ID,
        name: "Only of the other account",
      }),
    ]);
    return { universeRepository };
  }

  it("finds an identical name", async () => {
    expect(await isUniverseNameInUse(await setUp(), actor, "Second universe")).toBe(true);
  });

  it("ignores letter case", async () => {
    expect(await isUniverseNameInUse(await setUp(), actor, "SECOND UNIVERSE")).toBe(true);
  });

  it("ignores accents in either direction", async () => {
    const dependencies = await setUp();

    expect(await isUniverseNameInUse(dependencies, actor, "Cronicas de Hielo")).toBe(true);
    expect(await isUniverseNameInUse(dependencies, actor, "crÓnicas dé hielo")).toBe(true);
  });

  it("ignores whether an accent is written composed or decomposed", async () => {
    const dependencies = await setUp();

    expect(await isUniverseNameInUse(dependencies, actor, "Crónicas de Hielo")).toBe(true);
  });

  it("ignores surrounding and repeated whitespace", async () => {
    expect(await isUniverseNameInUse(await setUp(), actor, "  Second    universe  ")).toBe(true);
  });

  it("finds no match for a different name", async () => {
    const dependencies = await setUp();

    expect(await isUniverseNameInUse(dependencies, actor, "Third universe")).toBe(false);
    expect(await isUniverseNameInUse(dependencies, actor, "Second")).toBe(false);
  });

  it.each(["", "   ", "\n\t "])("returns false for the empty name %j", async (rawName) => {
    expect(await isUniverseNameInUse(await setUp(), actor, rawName)).toBe(false);
  });

  it("returns false when the actor has no universes", async () => {
    const { universeRepository } = await createStorage();

    expect(await isUniverseNameInUse({ universeRepository }, actor, "Anything")).toBe(false);
  });

  it("ignores the universes of another account", async () => {
    const dependencies = await setUp();

    expect(await isUniverseNameInUse(dependencies, actor, "Only of the other account")).toBe(false);
    expect(
      await isUniverseNameInUse(
        dependencies,
        buildActingUser(SECOND_OWNER_ID),
        "Only of the other account",
      ),
    ).toBe(true);
    expect(
      await isUniverseNameInUse(dependencies, buildActingUser(SECOND_OWNER_ID), "Second universe"),
    ).toBe(false);
  });
});
