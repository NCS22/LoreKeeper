import { describe, expect, it } from "vitest";
import { rememberUniverse } from "@/modules/universes/application/remember-universe";
import { UniverseNotFoundError } from "@/modules/universes/domain/universe-errors";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

const OWN_UNIVERSE_ID = "00000000-0000-4000-8000-000000000001";
const SECOND_OWN_UNIVERSE_ID = "00000000-0000-4000-8000-000000000002";
const FOREIGN_UNIVERSE_ID = "00000000-0000-4000-8000-000000000003";
const NONEXISTENT_UNIVERSE_ID = "00000000-0000-4000-8000-0000000000ff";

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(universeStorageFactories)("rememberUniverse: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);

  async function setUp() {
    return createStorage([
      buildUniverse({ id: OWN_UNIVERSE_ID, name: "Own universe" }),
      buildUniverse({ id: SECOND_OWN_UNIVERSE_ID, name: "Second own universe" }),
      buildUniverse({ id: FOREIGN_UNIVERSE_ID, ownerId: SECOND_OWNER_ID, name: "Foreign universe" }),
    ]);
  }

  it("stores an own universe as the remembered universe", async () => {
    const storage = await setUp();

    await rememberUniverse(storage, actor, { universeId: OWN_UNIVERSE_ID });

    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
      OWN_UNIVERSE_ID,
    );
  });

  it("keeps the last universe remembered", async () => {
    const storage = await setUp();

    await rememberUniverse(storage, actor, { universeId: OWN_UNIVERSE_ID });
    await rememberUniverse(storage, actor, { universeId: SECOND_OWN_UNIVERSE_ID });

    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
      SECOND_OWN_UNIVERSE_ID,
    );
  });

  it("accepts the identifier in upper case and stores it in lower case", async () => {
    const storage = await createStorage([
      buildUniverse({ id: "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b" }),
    ]);

    await rememberUniverse(storage, actor, { universeId: "3F2B8C1E-5D4A-4B6F-9A7E-1C2D3E4F5A6B" });

    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
      "3f2b8c1e-5d4a-4b6f-9a7e-1c2d3e4f5a6b",
    );
  });

  it.each(["", "   ", "not-a-uuid", "universe-1"])(
    "rejects the identifier %j as a validation error on universeId, storing nothing",
    async (universeId) => {
      const storage = await setUp();

      const error = await captureRejection(rememberUniverse(storage, actor, { universeId }));

      expect(error).toBeInstanceOf(ValidationError);
      expect(error).toMatchObject({
        issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }],
      });
      expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBeNull();
    },
  );

  it("rejects a missing identifier as a validation error", async () => {
    const storage = await setUp();
    // The command type forbids this; a direct call from outside the type system may not.
    // JSON.parse is typed as returning `any`, which stands for input that never met the type.
    const commandWithoutIdentifier: { universeId: string } = JSON.parse("{}");

    const error = await captureRejection(
      rememberUniverse(storage, actor, commandWithoutIdentifier),
    );

    expect(error).toBeInstanceOf(ValidationError);
  });

  it("gives the same not found error for a foreign and for a nonexistent universe, storing nothing", async () => {
    const storage = await setUp();

    const foreignError = await captureRejection(
      rememberUniverse(storage, actor, { universeId: FOREIGN_UNIVERSE_ID }),
    );
    const nonexistentError = await captureRejection(
      rememberUniverse(storage, actor, { universeId: NONEXISTENT_UNIVERSE_ID }),
    );

    expect(foreignError).toBeInstanceOf(UniverseNotFoundError);
    expect(nonexistentError).toBeInstanceOf(UniverseNotFoundError);
    expect(foreignError).toEqual(nonexistentError);
    expect(foreignError).toMatchObject({ message: "The universe was not found.", code: "NOT_FOUND" });
    expect(nonexistentError).toMatchObject({ message: "The universe was not found.", code: "NOT_FOUND" });
    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBeNull();
    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(SECOND_OWNER_ID)).toBeNull();
  });

  it("keeps the remembered universe of each account apart", async () => {
    const storage = await setUp();
    const otherActor = buildActingUser(SECOND_OWNER_ID);

    await rememberUniverse(storage, actor, { universeId: OWN_UNIVERSE_ID });
    await rememberUniverse(storage, otherActor, { universeId: FOREIGN_UNIVERSE_ID });

    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(FIRST_OWNER_ID)).toBe(
      OWN_UNIVERSE_ID,
    );
    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(SECOND_OWNER_ID)).toBe(
      FOREIGN_UNIVERSE_ID,
    );
  });

  it("does not let an account remember the universe of the other one", async () => {
    const storage = await setUp();
    const otherActor = buildActingUser(SECOND_OWNER_ID);

    const error = await captureRejection(
      rememberUniverse(storage, otherActor, { universeId: OWN_UNIVERSE_ID }),
    );

    expect(error).toBeInstanceOf(UniverseNotFoundError);
    expect(await storage.rememberedUniverseRepository.findRememberedUniverseId(SECOND_OWNER_ID)).toBeNull();
  });
});
