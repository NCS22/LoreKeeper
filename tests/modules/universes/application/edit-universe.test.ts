import { describe, expect, it } from "vitest";
import {
  editUniverse,
  type EditUniverseCommand,
  type EditUniverseDependencies,
} from "@/modules/universes/application/edit-universe";
import { MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH } from "@/modules/universes/domain/universe-description";
import { MAXIMUM_UNIVERSE_NAME_LENGTH } from "@/modules/universes/domain/universe-name";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";
import {
  buildActingUser,
  buildUniverse,
  FIRST_OWNER_ID,
  SECOND_OWNER_ID,
  universeStorageFactories,
} from "../../../support/universe-repository-factories";

const EDITED_UNIVERSE_ID = "00000000-0000-4000-8000-0000000000b1";
const UNIVERSE_WITHOUT_DESCRIPTION_ID = "00000000-0000-4000-8000-0000000000b2";
const EDIT_TIME = new Date("2026-06-01T09:15:00.000Z");

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

async function captureValidationError(operation: Promise<unknown>): Promise<ValidationError> {
  const failure = await captureRejection(operation);
  if (failure instanceof ValidationError) {
    return failure;
  }
  throw failure;
}

/** The same storage, except that every update of name and description fails as the storage does. */
function withFailingUpdates(
  universeRepository: UniverseRepository,
  storageFailure: InfrastructureError,
): UniverseRepository {
  return {
    findAllOwnedBy: (ownerId) => universeRepository.findAllOwnedBy(ownerId),
    findOwnedById: (ownerId, universeId) => universeRepository.findOwnedById(ownerId, universeId),
    add: (universe) => universeRepository.add(universe),
    updateNameAndDescription: async () => {
      throw storageFailure;
    },
  };
}

describe.each(universeStorageFactories)("editUniverse: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);
  // Composed (NFC) accented texts, so a decomposed copy of them is the same text.
  const editedUniverse = buildUniverse({
    id: EDITED_UNIVERSE_ID,
    name: "Tír na nÓg",
    description: "Écrits du Troisième Âge.",
    mode: "AUTHOR",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-02-01T10:00:00.000Z"),
  });
  const universeWithoutDescription = buildUniverse({
    id: UNIVERSE_WITHOUT_DESCRIPTION_ID,
    name: "Without description",
    description: null,
    createdAt: new Date("2026-01-02T10:00:00.000Z"),
    updatedAt: new Date("2026-01-02T10:00:00.000Z"),
  });

  const validCommand: EditUniverseCommand = {
    universeId: EDITED_UNIVERSE_ID,
    name: "Middle-earth",
    description: "Notes on the Third Age.",
  };

  async function setUp() {
    const storage = await createStorage([editedUniverse, universeWithoutDescription]);
    const dependencies: EditUniverseDependencies = {
      universeRepository: storage.universeRepository,
      getCurrentTime: () => new Date(EDIT_TIME),
    };
    return { universeRepository: storage.universeRepository, dependencies };
  }

  async function expectStoredUnchanged(universeRepository: UniverseRepository) {
    expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([
      editedUniverse,
      universeWithoutDescription,
    ]);
  }

  it("stores the trimmed name and description with the time of the clock and returns the stored universe", async () => {
    const { dependencies, universeRepository } = await setUp();

    const universeDto = await editUniverse(dependencies, actor, {
      universeId: EDITED_UNIVERSE_ID,
      name: "  Middle-earth  ",
      description: "  Notes\nover two lines  ",
    });

    expect(universeDto).toEqual({
      id: EDITED_UNIVERSE_ID,
      name: "Middle-earth",
      description: "Notes\nover two lines",
      mode: "AUTHOR",
      createdAt: "2026-01-01T10:00:00.000Z",
      updatedAt: "2026-06-01T09:15:00.000Z",
    });
    const storedUniverse = await universeRepository.findOwnedById(FIRST_OWNER_ID, EDITED_UNIVERSE_ID);
    expect(storedUniverse?.name).toBe("Middle-earth");
    expect(storedUniverse?.description).toBe("Notes\nover two lines");
    expect(storedUniverse?.updatedAt).toEqual(EDIT_TIME);
  });

  it("keeps the identifier, owner, mode and creation time, and the other universes", async () => {
    const { dependencies, universeRepository } = await setUp();

    await editUniverse(dependencies, actor, validCommand);

    expect(await universeRepository.findAllOwnedBy(FIRST_OWNER_ID)).toEqual([
      {
        ...editedUniverse,
        name: "Middle-earth",
        description: "Notes on the Third Age.",
        updatedAt: EDIT_TIME,
      },
      universeWithoutDescription,
    ]);
  });

  it("ignores a mode and an owner smuggled into the command", async () => {
    const { dependencies, universeRepository } = await setUp();
    const commandWithForgedFields = { ...validCommand, mode: "READER", ownerId: SECOND_OWNER_ID };

    const universeDto = await editUniverse(dependencies, actor, commandWithForgedFields);

    expect(universeDto.mode).toBe("AUTHOR");
    const storedUniverse = await universeRepository.findOwnedById(FIRST_OWNER_ID, EDITED_UNIVERSE_ID);
    expect(storedUniverse?.mode).toBe("AUTHOR");
    expect(storedUniverse?.ownerId).toBe(FIRST_OWNER_ID);
    expect(await universeRepository.findAllOwnedBy(SECOND_OWNER_ID)).toEqual([]);
  });

  it.each([null, "", "  \n "])(
    "clears the description for %j, which is a change stored with the time of the clock",
    async (rawDescription) => {
      const { dependencies, universeRepository } = await setUp();

      const universeDto = await editUniverse(dependencies, actor, {
        universeId: EDITED_UNIVERSE_ID,
        name: editedUniverse.name,
        description: rawDescription,
      });

      expect(universeDto.description).toBeNull();
      expect(universeDto.updatedAt).toBe("2026-06-01T09:15:00.000Z");
      const storedUniverse = await universeRepository.findOwnedById(FIRST_OWNER_ID, EDITED_UNIVERSE_ID);
      expect(storedUniverse?.description).toBeNull();
      expect(storedUniverse?.updatedAt).toEqual(EDIT_TIME);
    },
  );

  it("stores a name that differs from the stored one only in letter case", async () => {
    const { dependencies, universeRepository } = await setUp();

    await editUniverse(dependencies, actor, {
      universeId: EDITED_UNIVERSE_ID,
      name: "TÍR NA NÓG",
      description: editedUniverse.description,
    });

    const storedUniverse = await universeRepository.findOwnedById(FIRST_OWNER_ID, EDITED_UNIVERSE_ID);
    expect(storedUniverse?.name).toBe("TÍR NA NÓG");
    expect(storedUniverse?.updatedAt).toEqual(EDIT_TIME);
  });

  it("accepts a name and a description at their limits, counted in code points after trimming", async () => {
    const { dependencies } = await setUp();
    const nameAtLimit = "😀".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH);
    const descriptionAtLimit = "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH);

    const universeDto = await editUniverse(dependencies, actor, {
      universeId: EDITED_UNIVERSE_ID,
      name: `  ${nameAtLimit}  `,
      description: ` ${descriptionAtLimit}\n`,
    });

    expect(universeDto.name).toBe(nameAtLimit);
    expect(universeDto.description).toBe(descriptionAtLimit);
  });

  it("turns a failing storage into the InfrastructureError it reports", async () => {
    const { universeRepository } = await setUp();
    const storageFailure = new InfrastructureError("The universe storage failed.");
    const dependencies: EditUniverseDependencies = {
      universeRepository: withFailingUpdates(universeRepository, storageFailure),
      getCurrentTime: () => new Date(EDIT_TIME),
    };

    const failure = await captureRejection(editUniverse(dependencies, actor, validCommand));

    expect(failure).toBe(storageFailure);
    await expectStoredUnchanged(universeRepository);
  });

  describe("validation", () => {
    const tooLongName: ValidationIssue = {
      field: "name",
      code: "NAME_TOO_LONG",
      maximumLength: MAXIMUM_UNIVERSE_NAME_LENGTH,
    };

    it.each<readonly [string, string, ValidationIssue]>([
      ["empty", "", { field: "name", code: "NAME_REQUIRED" }],
      ["only whitespace", "  \n ", { field: "name", code: "NAME_REQUIRED" }],
      ["one character over the limit", "n".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH + 1), tooLongName],
      ["one code point over the limit", "😀".repeat(MAXIMUM_UNIVERSE_NAME_LENGTH + 1), tooLongName],
      ["with the null character", "Arda\u0000", { field: "name", code: "NAME_INVALID_CHARACTERS" }],
      ["with a lone surrogate", "Arda\uD800", { field: "name", code: "NAME_INVALID_CHARACTERS" }],
    ])("rejects a name %s on its field and stores nothing", async (_case, rawName, expectedIssue) => {
      const { dependencies, universeRepository } = await setUp();

      const error = await captureValidationError(
        editUniverse(dependencies, actor, { ...validCommand, name: rawName }),
      );

      expect(error.issues).toEqual([expectedIssue]);
      await expectStoredUnchanged(universeRepository);
    });

    it.each<readonly [string, string, ValidationIssue]>([
      [
        "one character over the limit",
        "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH + 1),
        {
          field: "description",
          code: "DESCRIPTION_TOO_LONG",
          maximumLength: MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH,
        },
      ],
      ["with the null character", "Notes\u0000", { field: "description", code: "DESCRIPTION_INVALID_CHARACTERS" }],
      ["with a lone surrogate", "Notes\uDC00", { field: "description", code: "DESCRIPTION_INVALID_CHARACTERS" }],
    ])("rejects a description %s on its field and stores nothing", async (_case, rawDescription, expectedIssue) => {
      const { dependencies, universeRepository } = await setUp();

      const error = await captureValidationError(
        editUniverse(dependencies, actor, { ...validCommand, description: rawDescription }),
      );

      expect(error.issues).toEqual([expectedIssue]);
      await expectStoredUnchanged(universeRepository);
    });

    it("reports the failing name and description together in one error", async () => {
      const { dependencies, universeRepository } = await setUp();

      const error = await captureValidationError(
        editUniverse(dependencies, actor, {
          universeId: EDITED_UNIVERSE_ID,
          name: "   ",
          description: "d".repeat(MAXIMUM_UNIVERSE_DESCRIPTION_LENGTH + 1),
        }),
      );

      expect(error.issues.map((issue) => `${issue.field}:${issue.code}`)).toEqual([
        "name:NAME_REQUIRED",
        "description:DESCRIPTION_TOO_LONG",
      ]);
      await expectStoredUnchanged(universeRepository);
    });
  });

  describe("no real change", () => {
    it.each([
      ["the same values", "Tír na nÓg", "Écrits du Troisième Âge."],
      ["whitespace at the ends only", "  Tír na nÓg \n", " Écrits du Troisième Âge.  "],
      [
        "the decomposed form of the same texts",
        "Tír na nÓg".normalize("NFD"),
        "Écrits du Troisième Âge.".normalize("NFD"),
      ],
    ])(
      "answers success with the stored universe for %s, writing nothing and keeping updatedAt",
      async (_case, rawName, rawDescription) => {
        const { dependencies, universeRepository } = await setUp();

        const universeDto = await editUniverse(dependencies, actor, {
          universeId: EDITED_UNIVERSE_ID,
          name: rawName,
          description: rawDescription,
        });

        expect(universeDto).toEqual({
          id: EDITED_UNIVERSE_ID,
          name: "Tír na nÓg",
          description: "Écrits du Troisième Âge.",
          mode: "AUTHOR",
          createdAt: "2026-01-01T10:00:00.000Z",
          updatedAt: "2026-02-01T10:00:00.000Z",
        });
        await expectStoredUnchanged(universeRepository);
      },
    );

    it.each([null, "", " \n "])(
      "answers success with the stored universe when there was no description and %j is sent",
      async (rawDescription) => {
        const { dependencies, universeRepository } = await setUp();

        const universeDto = await editUniverse(dependencies, actor, {
          universeId: UNIVERSE_WITHOUT_DESCRIPTION_ID,
          name: universeWithoutDescription.name,
          description: rawDescription,
        });

        expect(universeDto.description).toBeNull();
        expect(universeDto.updatedAt).toBe("2026-01-02T10:00:00.000Z");
        await expectStoredUnchanged(universeRepository);
      },
    );
  });
});
