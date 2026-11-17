import { describe, expect, it } from "vitest";
import {
  createUniverse,
  type CreateUniverseCommand,
  type CreateUniverseDependencies,
} from "@/modules/universes/application/create-universe";
import { MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH } from "@/modules/universes/domain/universe-description";
import { MAXIMUM_UNIVERSE_NAME_LENGTH } from "@/modules/universes/domain/universe-name";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

const CREATION_TIME = new Date("2026-03-04T12:30:00.000Z");

async function captureValidationError(creation: Promise<unknown>): Promise<ValidationError> {
  try {
    await creation;
  } catch (error) {
    if (error instanceof ValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error("Expected the creation to be rejected with a ValidationError.");
}

describe.each(universeStorageFactories)("createUniverse: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  const existingUniverse = buildUniverse({
    id: "00000000-0000-4000-8000-0000000000e1",
    name: "Existing universe",
  });

  async function setUp(generatedIds: readonly string[] = ["generated-1", "generated-2", "generated-3"]) {
    const { universeRepository } = await createStorage([existingUniverse]);
    let nextIdIndex = 0;
    const dependencies: CreateUniverseDependencies = {
      universeRepository,
      generateUniverseId: () => {
        const generatedId = generatedIds[nextIdIndex];
        nextIdIndex += 1;
        if (generatedId === undefined) {
          throw new Error("The test ran out of generated identifiers.");
        }
        return generatedId;
      },
      getCurrentTime: () => new Date(CREATION_TIME),
    };
    return { universeRepository, dependencies };
  }

  const validCommand: CreateUniverseCommand = {
    name: "Middle-earth",
    description: "Notes on the Third Age.",
    mode: "READER",
  };

  it("creates a READER universe and returns its DTO, without the owner", async () => {
    const { dependencies } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, validCommand);

    expect(universeDto).toEqual({
      id: "generated-1",
      name: "Middle-earth",
      description: "Notes on the Third Age.",
      mode: "READER",
      createdAt: "2026-03-04T12:30:00.000Z",
      updatedAt: "2026-03-04T12:30:00.000Z",
    });
  });

  it("creates an AUTHOR universe", async () => {
    const { dependencies } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, { ...validCommand, mode: "AUTHOR" });

    expect(universeDto.mode).toBe("AUTHOR");
  });

  it("stores the universe owned by the acting user, after the existing ones", async () => {
    const { dependencies, universeRepository } = await setUp();

    await createUniverse(dependencies, actor, validCommand);

    const storedUniverses = await universeRepository.findAllOwnedBy(FIRST_OWNER_ID);
    expect(storedUniverses.map((universe) => universe.id)).toEqual([
      "00000000-0000-4000-8000-0000000000e1",
      "generated-1",
    ]);
    expect(storedUniverses.every((universe) => universe.ownerId === FIRST_OWNER_ID)).toBe(true);
  });

  it("ignores an owner smuggled into the command", async () => {
    const { dependencies, universeRepository } = await setUp();
    const commandWithForgedOwner = { ...validCommand, ownerId: SECOND_OWNER_ID };

    await createUniverse(dependencies, actor, commandWithForgedOwner);

    expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([]);
    expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toHaveLength(2);
  });

  it("trims the name and the description", async () => {
    const { dependencies } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, {
      name: "  Middle-earth  ",
      description: "  Notes\nover two lines  ",
      mode: "READER",
    });

    expect(universeDto.name).toBe("Middle-earth");
    expect(universeDto.description).toBe("Notes\nover two lines");
  });

  it.each([null, "", "   \n  "])("stores no description for %j", async (rawDescription) => {
    const { dependencies } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, {
      ...validCommand,
      description: rawDescription,
    });

    expect(universeDto.description).toBeNull();
  });

  it("accepts a name and a description exactly at their limits", async () => {
    const { dependencies } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, {
      name: "n".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH),
      description: "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH),
      mode: "READER",
    });

    expect(universeDto.name).toHaveLength(MAXIMUM_UNIVERSE_NAME_LENGTH);
    expect(universeDto.description).toHaveLength(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);
  });

  it("stores createdAt equal to updatedAt, read once from the clock", async () => {
    const { dependencies, universeRepository } = await setUp();

    await createUniverse(dependencies, actor, validCommand);

    const storedUniverse = (await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).at(-1);
    expect(storedUniverse?.createdAt).toEqual(CREATION_TIME);
    expect(storedUniverse?.updatedAt).toEqual(CREATION_TIME);
  });

  it("is born empty: only the universe's own fields are stored, with no cover image", async () => {
    const { dependencies, universeRepository } = await setUp();

    const universeDto = await createUniverse(dependencies, actor, validCommand);

    const storedUniverse = (await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).at(-1);
    expect(Object.keys(universeDto).sort()).toEqual([
      "createdAt",
      "description",
      "id",
      "mode",
      "name",
      "updatedAt",
    ]);
    expect(Object.keys(storedUniverse ?? {}).sort()).toEqual([
      "createdAt",
      "description",
      "id",
      "mode",
      "name",
      "ownerId",
      "updatedAt",
    ]);
  });

  it("does not change the other universes", async () => {
    const { dependencies, universeRepository } = await setUp();

    await createUniverse(dependencies, actor, validCommand);

    const [firstStoredUniverse] = await universeRepository.findAllOwnedBy(FIRST_OWNER_ID);
    expect(firstStoredUniverse).toEqual(existingUniverse);
  });

  it("creates a universe whose name matches an existing one, with a different identifier", async () => {
    const { dependencies, universeRepository } = await setUp();

    const firstDuplicate = await createUniverse(dependencies, actor, {
      ...validCommand,
      name: "  EXISTING   Universe ",
    });
    const secondDuplicate = await createUniverse(dependencies, actor, {
      ...validCommand,
      name: "Existing universe",
    });

    expect(firstDuplicate.id).not.toBe(secondDuplicate.id);
    expect(firstDuplicate.id).not.toBe(existingUniverse.id);
    expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toHaveLength(3);
  });

  it("keeps the universes of two actors apart", async () => {
    const { dependencies, universeRepository } = await setUp();
    const otherActor = buildActingUser(SECOND_OWNER_ID);

    await createUniverse(dependencies, otherActor, { ...validCommand, name: "Of the other" });

    const universesOfOtherActor = await universeRepository.findAllOwnedBy(SECOND_OWNER_ID);
    expect(universesOfOtherActor.map((universe) => universe.name)).toEqual(["Of the other"]);
    expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([existingUniverse]);
  });

  describe("validation", () => {
    it.each(["", "    ", "\n\t"])("rejects the name %j as required", async (rawName) => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, { ...validCommand, name: rawName }),
      );

      expect(error.issues).toEqual([{ field: "name", code: "NAME_REQUIRED" }]);
    });

    it("rejects a name over the limit and reports the limit", async () => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, {
          ...validCommand,
          name: "n".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH + 1),
        }),
      );

      expect(error.issues).toEqual([
        { field: "name", code: "NAME_TOO_LONG", maximumLength: MAXIMUM_UNIVERSE_NAME_LENGTH },
      ]);
    });

    it("rejects a description over the limit and reports the limit", async () => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, {
          ...validCommand,
          description: "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH + 1),
        }),
      );

      expect(error.issues).toEqual([
        {
          field: "description",
          code: "DESCRIPTION_TOO_LONG",
          maximumLength: MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH,
        },
      ]);
    });

    it.each([
      ["the null character", "Ember\u0000", "name", "NAME_INVALID_CHARACTERS"],
      ["a lone surrogate", "Ember\uD800", "name", "NAME_INVALID_CHARACTERS"],
    ])("rejects a name with %s as a validation issue on its field", async (_description, rawName, field, code) => {
      const { dependencies, universeRepository } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, { ...validCommand, name: rawName }),
      );

      expect(error.issues).toEqual([{ field, code }]);
      expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([existingUniverse]);
    });

    it("rejects a description with the null character as a validation issue on its field", async () => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, { ...validCommand, description: "Notes\u0000" }),
      );

      expect(error.issues).toEqual([
        { field: "description", code: "DESCRIPTION_INVALID_CHARACTERS" },
      ]);
    });

    it.each(["", "reader", "OWNER", " READER"])("rejects the mode %j", async (rawMode) => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, { ...validCommand, mode: rawMode }),
      );

      expect(error.issues).toEqual([{ field: "mode", code: "MODE_INVALID" }]);
    });

    it("reports every failing field together in one error", async () => {
      const { dependencies } = await setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, actor, {
          name: "   ",
          description: "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH + 1),
          mode: "NOT_A_MODE",
        }),
      );

      expect(error.issues.map((issue) => `${issue.field}:${issue.code}`)).toEqual([
        "name:NAME_REQUIRED",
        "description:DESCRIPTION_TOO_LONG",
        "mode:MODE_INVALID",
      ]);
    });

    it("stores nothing and consumes no identifier when it fails", async () => {
      const { dependencies, universeRepository } = await setUp([]);

      await captureValidationError(
        createUniverse(dependencies, actor, { name: "", description: null, mode: "NOT_A_MODE" }),
      );

      expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([existingUniverse]);
    });
  });
});
