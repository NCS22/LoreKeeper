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

  // Each difference on its own is proved by `toComparableUniverseName` in
  // tests/modules/universes/domain/universe-name.test.ts; this case proves the use case applies it.
  it("finds a name that differs in case, accents, accent composition and whitespace", async () => {
    // Stored: "Crónicas de Hielo" with a composed ó. Typed: other letter case, a decomposed ó
    // (O + U+0301), an accent the stored name lacks (É), and surrounding and repeated spaces.
    const typedName = "  cRO\u0301NICAS   DÉ  hielo ";

    expect(await isUniverseNameInUse(await setUp(), actor, typedName)).toBe(true);
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

  describe("leaving out one universe (spec 007a FR-8)", () => {
    const ICE_CHRONICLES_ID = "00000000-0000-4000-8000-000000000001";
    const SECOND_UNIVERSE_ID = "00000000-0000-4000-8000-000000000002";
    const OTHER_ACCOUNT_UNIVERSE_ID = "00000000-0000-4000-8000-000000000003";
    const NONEXISTENT_UNIVERSE_ID = "00000000-0000-4000-8000-000000000009";

    it("never counts the excluded universe itself for its own name", async () => {
      expect(
        await isUniverseNameInUse(await setUp(), actor, "Crónicas de Hielo", ICE_CHRONICLES_ID),
      ).toBe(false);
    });

    it.each([
      ["case", "crónicas DE hielo"],
      ["accents", "Cronicas de Hiélo"],
      ["spacing", "  Crónicas   de Hielo "],
      ["composition", "Crónicas de Hielo"],
    ])(
      "never counts the excluded universe itself when the name changes only in %s",
      async (_difference, typedName) => {
        expect(await isUniverseNameInUse(await setUp(), actor, typedName, ICE_CHRONICLES_ID)).toBe(
          false,
        );
      },
    );

    it("leaves out the excluded universe when its identifier arrives in upper case", async () => {
      expect(
        await isUniverseNameInUse(
          await setUp(),
          actor,
          "Crónicas de Hielo",
          ICE_CHRONICLES_ID.toUpperCase(),
        ),
      ).toBe(false);
    });

    it("still counts another own universe with the same comparable name", async () => {
      const { universeRepository } = await createStorage([
        buildUniverse({ id: ICE_CHRONICLES_ID, name: "Crónicas de Hielo" }),
        buildUniverse({ id: SECOND_UNIVERSE_ID, name: "CRONICAS  de hielo" }),
      ]);

      expect(
        await isUniverseNameInUse(
          { universeRepository },
          actor,
          "Crónicas de Hielo",
          ICE_CHRONICLES_ID,
        ),
      ).toBe(true);
    });

    it("still counts another own universe when the excluded one has another name", async () => {
      expect(
        await isUniverseNameInUse(await setUp(), actor, "Second universe", ICE_CHRONICLES_ID),
      ).toBe(true);
    });

    it.each(["", "   ", "not-a-universe-id", "00000000-0000-4000-8000-00000000000"])(
      "excludes nothing, and never throws, for the malformed identifier %j",
      async (malformedUniverseId) => {
        expect(
          await isUniverseNameInUse(await setUp(), actor, "Crónicas de Hielo", malformedUniverseId),
        ).toBe(true);
      },
    );

    it("excludes nothing for the identifier of a universe of another account", async () => {
      const dependencies = await setUp();

      expect(
        await isUniverseNameInUse(dependencies, actor, "Second universe", OTHER_ACCOUNT_UNIVERSE_ID),
      ).toBe(true);
      expect(
        await isUniverseNameInUse(
          dependencies,
          actor,
          "Only of the other account",
          OTHER_ACCOUNT_UNIVERSE_ID,
        ),
      ).toBe(false);
    });

    it("excludes nothing for the identifier of a nonexistent universe", async () => {
      expect(
        await isUniverseNameInUse(await setUp(), actor, "Second universe", NONEXISTENT_UNIVERSE_ID),
      ).toBe(true);
    });

    it("never counts the names of another account, also with an own universe excluded", async () => {
      expect(
        await isUniverseNameInUse(
          await setUp(),
          actor,
          "Only of the other account",
          SECOND_UNIVERSE_ID,
        ),
      ).toBe(false);
    });
  });
});
