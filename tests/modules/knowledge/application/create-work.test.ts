import { describe, expect, it } from "vitest";
import { createWork, type CreateWorkCommand } from "@/modules/knowledge/application/create-work";
import { KnowledgeItemNotFoundError } from "@/modules/knowledge/domain/knowledge-errors";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  type KnowledgeStorage,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import { knowledgeStorageFactories } from "../../../support/knowledge-repository-factories";
import { buildActingUser, FIRST_OWNER_ID } from "../../../support/universe-owners";

const NONEXISTENT_UNIVERSE_ID = "00000000-0000-4000-8000-0000000000ff";
const GENERATED_WORK_ID = "00000000-0000-4000-8000-0000000000e1";
const CREATION_TIME = new Date("2026-05-01T12:00:00.000Z");

const VALID_COMMAND: CreateWorkCommand = {
  universeId: FIRST_UNIVERSE.id,
  title: "My Novel",
  medium: "NOVEL",
  unitCount: "3",
};

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(knowledgeStorageFactories)("createWork: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);

  async function setUp() {
    const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE]);
    const dependencies = {
      ...storage,
      generateWorkId: () => GENERATED_WORK_ID,
      getCurrentTime: () => CREATION_TIME,
    };
    return { storage, dependencies };
  }

  async function expectNothingStored(storage: KnowledgeStorage): Promise<void> {
    expect(await storage.countStoredWorks()).toBe(0);
    expect(await storage.readStoredUnitsOfWork(GENERATED_WORK_ID)).toEqual([]);
  }

  it("stores the work with its units labelled 1 to N and returns its DTO with the unit wording", async () => {
    const { storage, dependencies } = await setUp();

    const workDto = await createWork(dependencies, actor, VALID_COMMAND);

    expect(workDto).toEqual({
      id: GENERATED_WORK_ID,
      title: "My Novel",
      medium: "NOVEL",
      unitWording: "chapter",
      unitCount: 3,
      createdAt: "2026-05-01T12:00:00.000Z",
    });
    expect(await storage.readStoredUnitsOfWork(GENERATED_WORK_ID)).toEqual([
      { label: "1", ordinal: 1000 },
      { label: "2", ordinal: 2000 },
      { label: "3", ordinal: 3000 },
    ]);
    expect(await storage.workRepository.findAllInUniverse(buildViewerContext())).toEqual([
      {
        id: GENERATED_WORK_ID,
        universeId: FIRST_UNIVERSE.id,
        title: "My Novel",
        medium: "NOVEL",
        unitCount: 3,
        createdAt: CREATION_TIME,
        updatedAt: CREATION_TIME,
      },
    ]);
  });

  it("trims the title, ignores spaces around the number and leading zeros", async () => {
    const { dependencies } = await setUp();

    const workDto = await createWork(dependencies, actor, {
      ...VALID_COMMAND,
      title: "  The   Long Road \n",
      medium: "ANIME",
      unitCount: " 012 ",
    });

    expect(workDto).toMatchObject({
      title: "The   Long Road",
      medium: "ANIME",
      unitWording: "episode",
      unitCount: 12,
    });
  });

  it("stores a work of 5000 units in one operation", async () => {
    const { storage, dependencies } = await setUp();

    const workDto = await createWork(dependencies, actor, { ...VALID_COMMAND, unitCount: "5000" });

    expect(workDto.unitCount).toBe(5000);
    const storedUnits = await storage.readStoredUnitsOfWork(GENERATED_WORK_ID);
    expect(storedUnits).toHaveLength(5000);
    expect(storedUnits.at(-1)).toEqual({ label: "5000", ordinal: 5_000_000 });
  });

  it("stores the work in the universe of the command, owned through it by the acting user", async () => {
    const { storage, dependencies } = await setUp();

    await createWork(dependencies, actor, { ...VALID_COMMAND, universeId: FIRST_UNIVERSE.id.toUpperCase() });

    const listedWorks = await storage.workRepository.findAllInUniverse(buildViewerContext());
    expect(listedWorks.map((work) => work.universeId)).toEqual([FIRST_UNIVERSE.id]);
  });

  it("reports every failing field in one validation error and stores nothing", async () => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(
      createWork(dependencies, actor, {
        universeId: FIRST_UNIVERSE.id,
        title: "   ",
        medium: "PODCAST",
        unitCount: "1e3",
      }),
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure).toMatchObject({
      issues: [
        { field: "title", code: "TITLE_REQUIRED" },
        { field: "medium", code: "MEDIUM_INVALID" },
        { field: "unitCount", code: "UNIT_COUNT_INVALID" },
      ],
    });
    await expectNothingStored(storage);
  });

  it.each([
    ["a title of 201 characters", { title: "a".repeat(201) }, "title", "TITLE_TOO_LONG"],
    ["a medium in lower case", { medium: "novel" }, "medium", "MEDIUM_INVALID"],
    ["a missing number", { unitCount: "" }, "unitCount", "UNIT_COUNT_REQUIRED"],
    ["zero units", { unitCount: "0" }, "unitCount", "UNIT_COUNT_OUT_OF_RANGE"],
    ["5001 units", { unitCount: "5001" }, "unitCount", "UNIT_COUNT_OUT_OF_RANGE"],
    ["a sign", { unitCount: "+12" }, "unitCount", "UNIT_COUNT_INVALID"],
    ["a decimal", { unitCount: "7.0" }, "unitCount", "UNIT_COUNT_INVALID"],
  ])("refuses %s with that field alone and stores nothing", async (_label, change, field, code) => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(createWork(dependencies, actor, { ...VALID_COMMAND, ...change }));

    expect(failure).toBeInstanceOf(ValidationError);
    // An array in `toMatchObject` must have the same length: this is the only issue.
    expect(failure).toMatchObject({ issues: [{ field, code }] });
    await expectNothingStored(storage);
  });

  it("gives the same not found error for a universe of another account and for a nonexistent one, storing nothing", async () => {
    const { storage, dependencies } = await setUp();

    const foreignFailure = await captureRejection(
      createWork(dependencies, actor, { ...VALID_COMMAND, universeId: SECOND_OWNER_UNIVERSE.id }),
    );
    const nonexistentFailure = await captureRejection(
      createWork(dependencies, actor, { ...VALID_COMMAND, universeId: NONEXISTENT_UNIVERSE_ID }),
    );

    expect(foreignFailure).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(foreignFailure).toEqual(nonexistentFailure);
    await expectNothingStored(storage);
    expect(
      await storage.workRepository.findAllInUniverse(buildViewerContext(SECOND_OWNER_UNIVERSE)),
    ).toEqual([]);
  });

  it("checks the universe before the fields, so invalid fields in a foreign universe still give not found", async () => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(
      createWork(dependencies, actor, {
        universeId: SECOND_OWNER_UNIVERSE.id,
        title: "",
        medium: "",
        unitCount: "",
      }),
    );

    expect(failure).toBeInstanceOf(KnowledgeItemNotFoundError);
    await expectNothingStored(storage);
  });

  it("rejects a malformed universe identifier as a validation error on universeId and stores nothing", async () => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(
      createWork(dependencies, actor, { ...VALID_COMMAND, universeId: "not-a-uuid" }),
    );

    expect(failure).toMatchObject({ issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }] });
    await expectNothingStored(storage);
  });

  it("ignores unit labels, an order, an owner or any other data that travels with the command", async () => {
    const { storage, dependencies } = await setUp();
    const commandWithExtraData = {
      ...VALID_COMMAND,
      ownerId: SECOND_OWNER_UNIVERSE.ownerId,
      id: NONEXISTENT_UNIVERSE_ID,
      unitKind: "EPISODE",
      units: [{ label: "Prologue", ordinal: 1 }],
    };

    const workDto = await createWork(dependencies, actor, commandWithExtraData);

    expect(workDto.id).toBe(GENERATED_WORK_ID);
    expect(workDto.unitWording).toBe("chapter");
    expect(await storage.readStoredUnitsOfWork(GENERATED_WORK_ID)).toEqual([
      { label: "1", ordinal: 1000 },
      { label: "2", ordinal: 2000 },
      { label: "3", ordinal: 3000 },
    ]);
  });

  it("stores nothing and fails with the infrastructure error when the units cannot be stored", async () => {
    const { storage, dependencies } = await setUp();
    await storage.makeUnitWritesFail();

    const failure = await captureRejection(createWork(dependencies, actor, VALID_COMMAND));

    await storage.restoreUnitWrites();
    expect(failure).toBeInstanceOf(InfrastructureError);
    await expectNothingStored(storage);
  });
});
