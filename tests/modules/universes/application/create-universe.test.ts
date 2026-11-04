import { describe, expect, it } from "vitest";
import {
  createUniverse,
  type CreateUniverseCommand,
  type CreateUniverseDependencies,
} from "@/modules/universes/application/create-universe";
import { MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH } from "@/modules/universes/domain/universe-description";
import { MAXIMUM_UNIVERSE_NAME_LENGTH } from "@/modules/universes/domain/universe-name";
import { ValidationError } from "@/shared/domain/validation-error";
import { buildUniverse, universeRepositoryFactories } from "../../../support/universe-repository-factories";

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

describe.each(universeRepositoryFactories)("createUniverse: %s", (_name, createRepository) => {
  const existingUniverse = buildUniverse({ id: "existing-1", name: "Existing universe" });

  function setUp(generatedIds: readonly string[] = ["generated-1", "generated-2", "generated-3"]) {
    const universeRepository = createRepository([existingUniverse]);
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

  it("creates a READER universe and returns its DTO", async () => {
    const { dependencies } = setUp();

    const universeDto = await createUniverse(dependencies, validCommand);

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
    const { dependencies } = setUp();

    const universeDto = await createUniverse(dependencies, { ...validCommand, mode: "AUTHOR" });

    expect(universeDto.mode).toBe("AUTHOR");
  });

  it("stores the created universe after the existing ones", async () => {
    const { dependencies, universeRepository } = setUp();

    await createUniverse(dependencies, validCommand);

    const storedUniverses = await universeRepository.findAll();
    expect(storedUniverses.map((universe) => universe.id)).toEqual(["existing-1", "generated-1"]);
  });

  it("trims the name and the description", async () => {
    const { dependencies } = setUp();

    const universeDto = await createUniverse(dependencies, {
      name: "  Middle-earth  ",
      description: "  Notes\nover two lines  ",
      mode: "READER",
    });

    expect(universeDto.name).toBe("Middle-earth");
    expect(universeDto.description).toBe("Notes\nover two lines");
  });

  it.each([null, "", "   \n  "])("stores no description for %j", async (rawDescription) => {
    const { dependencies } = setUp();

    const universeDto = await createUniverse(dependencies, {
      ...validCommand,
      description: rawDescription,
    });

    expect(universeDto.description).toBeNull();
  });

  it("accepts a name and a description exactly at their limits", async () => {
    const { dependencies } = setUp();

    const universeDto = await createUniverse(dependencies, {
      name: "n".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH),
      description: "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH),
      mode: "READER",
    });

    expect(universeDto.name).toHaveLength(MAXIMUM_UNIVERSE_NAME_LENGTH);
    expect(universeDto.description).toHaveLength(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);
  });

  it("stores createdAt equal to updatedAt, read once from the clock", async () => {
    const { dependencies, universeRepository } = setUp();

    await createUniverse(dependencies, validCommand);

    const storedUniverse = (await universeRepository.findAll()).at(-1);
    expect(storedUniverse?.createdAt).toEqual(CREATION_TIME);
    expect(storedUniverse?.updatedAt).toEqual(CREATION_TIME);
  });

  it("is born empty: only the universe's own fields are stored, with no cover image", async () => {
    const { dependencies, universeRepository } = setUp();

    const universeDto = await createUniverse(dependencies, validCommand);

    const storedUniverse = (await universeRepository.findAll()).at(-1);
    const expectedFields = ["createdAt", "description", "id", "mode", "name", "updatedAt"];
    expect(Object.keys(universeDto).sort()).toEqual(expectedFields);
    expect(Object.keys(storedUniverse ?? {}).sort()).toEqual(expectedFields);
  });

  it("does not change the other universes", async () => {
    const { dependencies, universeRepository } = setUp();

    await createUniverse(dependencies, validCommand);

    const [firstStoredUniverse] = await universeRepository.findAll();
    expect(firstStoredUniverse).toEqual(existingUniverse);
  });

  it("creates a universe whose name matches an existing one, with a different identifier", async () => {
    const { dependencies, universeRepository } = setUp();

    const firstDuplicate = await createUniverse(dependencies, {
      ...validCommand,
      name: "  EXISTING   Universe ",
    });
    const secondDuplicate = await createUniverse(dependencies, {
      ...validCommand,
      name: "Existing universe",
    });

    expect(firstDuplicate.id).not.toBe(secondDuplicate.id);
    expect(firstDuplicate.id).not.toBe(existingUniverse.id);
    expect(await universeRepository.findAll()).toHaveLength(3);
  });

  describe("validation", () => {
    it.each(["", "    ", "\n\t"])("rejects the name %j as required", async (rawName) => {
      const { dependencies } = setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, { ...validCommand, name: rawName }),
      );

      expect(error.issues).toEqual([{ field: "name", code: "NAME_REQUIRED" }]);
    });

    it("rejects a name over the limit and reports the limit", async () => {
      const { dependencies } = setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, {
          ...validCommand,
          name: "n".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH + 1),
        }),
      );

      expect(error.issues).toEqual([
        { field: "name", code: "NAME_TOO_LONG", maximumLength: MAXIMUM_UNIVERSE_NAME_LENGTH },
      ]);
    });

    it("rejects a description over the limit and reports the limit", async () => {
      const { dependencies } = setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, {
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

    it.each(["", "reader", "OWNER", " READER"])("rejects the mode %j", async (rawMode) => {
      const { dependencies } = setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, { ...validCommand, mode: rawMode }),
      );

      expect(error.issues).toEqual([{ field: "mode", code: "MODE_INVALID" }]);
    });

    it("reports every failing field together in one error", async () => {
      const { dependencies } = setUp();

      const error = await captureValidationError(
        createUniverse(dependencies, {
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
      const { dependencies, universeRepository } = setUp([]);

      await captureValidationError(
        createUniverse(dependencies, { name: "", description: null, mode: "NOT_A_MODE" }),
      );

      expect(await universeRepository.findAll()).toEqual([existingUniverse]);
    });
  });
});
