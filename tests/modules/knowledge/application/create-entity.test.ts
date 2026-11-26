import { describe, expect, it } from "vitest";
import { createEntity, type CreateEntityCommand } from "@/modules/knowledge/application/create-entity";
import type { WorkRepository } from "@/modules/knowledge/domain/work-repository";
import { KnowledgeItemNotFoundError } from "@/modules/knowledge/domain/knowledge-errors";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  SECOND_UNIVERSE_OF_FIRST_OWNER,
  storeWorkWithBoundaries,
} from "../../../support/contracts/entity-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  type KnowledgeStorage,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import {
  buildNewEntity,
  buildNewWork,
  buildNumberedTestUnits,
  knowledgeStorageFactories,
} from "../../../support/knowledge-repository-factories";
import { buildActingUser, FIRST_OWNER_ID } from "../../../support/universe-owners";

const OWN_WORK_ID = "00000000-0000-4000-8000-0000000000a0";
const FOREIGN_WORK_ID = "00000000-0000-4000-8000-0000000000a9";
const OTHER_UNIVERSE_WORK_ID = "00000000-0000-4000-8000-0000000000a8";
const NONEXISTENT_ID = "00000000-0000-4000-8000-0000000000ff";
const GENERATED_ENTITY_ID = "00000000-0000-4000-8000-0000000000e1";
const GENERATED_FRAGMENT_ID = "00000000-0000-4000-8000-0000000000f1";
const CREATION_TIME = new Date("2026-05-01T12:00:00.000Z");

const VALID_COMMAND: CreateEntityCommand = {
  universeId: FIRST_UNIVERSE.id,
  name: "Frodo",
  type: "CHARACTER",
  boundary: { workId: OWN_WORK_ID, unitNumber: "2" },
  fragment: null,
};

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

/** The work repository of the storage, counting the unit lookups it is asked for. */
function countUnitLookups(workRepository: WorkRepository) {
  const lookups = { count: 0 };
  const countingWorkRepository: WorkRepository = {
    add: (newWork) => workRepository.add(newWork),
    findAllInUniverse: (viewerContext) => workRepository.findAllInUniverse(viewerContext),
    findBoundaryOfUnitNumber: (viewerContext, workId, unitNumber) => {
      lookups.count += 1;
      return workRepository.findBoundaryOfUnitNumber(viewerContext, workId, unitNumber);
    },
  };
  return { lookups, countingWorkRepository };
}

describe.each(knowledgeStorageFactories)("createEntity: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);

  async function setUp() {
    const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER]);
    const ownUnits = await storeWorkWithBoundaries(storage, buildNewWork({ units: buildNumberedTestUnits(3) }));
    await storeWorkWithBoundaries(
      storage,
      buildNewWork({ id: FOREIGN_WORK_ID, universeId: SECOND_OWNER_UNIVERSE.id, units: buildNumberedTestUnits(3) }),
    );
    await storeWorkWithBoundaries(
      storage,
      buildNewWork({
        id: OTHER_UNIVERSE_WORK_ID,
        universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
        units: buildNumberedTestUnits(3),
      }),
    );
    const { lookups, countingWorkRepository } = countUnitLookups(storage.workRepository);
    const dependencies = {
      ownUniverseLookup: storage.ownUniverseLookup,
      workRepository: countingWorkRepository,
      entityRepository: storage.entityRepository,
      generateEntityId: () => GENERATED_ENTITY_ID,
      generateFragmentId: () => GENERATED_FRAGMENT_ID,
      getCurrentTime: () => CREATION_TIME,
    };
    return { storage, dependencies, ownUnits, lookups };
  }

  async function expectNothingStored(storage: KnowledgeStorage): Promise<void> {
    expect(await storage.countStoredEntities()).toBe(0);
    expect(await storage.countStoredFragments()).toBe(0);
  }

  it("stores an entity without a fragment at its introduction point and returns its summary with no notice", async () => {
    const { storage, dependencies, ownUnits } = await setUp();

    const creation = await createEntity(dependencies, actor, VALID_COMMAND);

    expect(creation).toEqual({
      entity: { id: GENERATED_ENTITY_ID, name: "Frodo", type: "CHARACTER", createdAt: "2026-05-01T12:00:00.000Z" },
      similarEntityName: null,
    });
    expect(await storage.entityRepository.findAllInUniverse(buildViewerContext())).toEqual([
      {
        id: GENERATED_ENTITY_ID,
        universeId: FIRST_UNIVERSE.id,
        type: "CHARACTER",
        name: "Frodo",
        introducedAt: ownUnits[1],
        createdAt: CREATION_TIME,
        updatedAt: CREATION_TIME,
      },
    ]);
    expect(await storage.countStoredFragments()).toBe(0);
  });

  it("trims the name, ignores spaces around the unit number and its leading zeros", async () => {
    const { storage, dependencies, ownUnits } = await setUp();

    const creation = await createEntity(dependencies, actor, {
      ...VALID_COMMAND,
      name: "  Samwise   Gamgee \n",
      type: "SPECIES",
      boundary: { workId: OWN_WORK_ID.toUpperCase(), unitNumber: " 003 " },
    });

    expect(creation.entity).toMatchObject({ name: "Samwise   Gamgee", type: "SPECIES" });
    const [storedEntity] = await storage.entityRepository.findAllInUniverse(buildViewerContext());
    expect(storedEntity?.introducedAt).toEqual(ownUnits[2]);
  });

  it("stores the entity and its first fragment, trimmed, with its own status and point, in one write", async () => {
    const { storage, dependencies, ownUnits } = await setUp();

    await createEntity(dependencies, actor, {
      ...VALID_COMMAND,
      boundary: { workId: OWN_WORK_ID, unitNumber: "1" },
      fragment: {
        content: "  Carries the ring.\n",
        status: "CONFIRMED",
        boundary: { workId: OWN_WORK_ID, unitNumber: "3" },
      },
    });

    expect(await storage.readStoredFragmentsOfEntity(GENERATED_ENTITY_ID)).toEqual([
      { content: "Carries the ring.", status: "CONFIRMED", revealedAt: ownUnits[2] },
    ]);
  });

  it.each([
    ["without a boundary", undefined],
    ["with a null boundary", null],
  ])("gives a fragment %s the point of its entity", async (_description, fragmentBoundary) => {
    const { storage, dependencies, ownUnits } = await setUp();

    await createEntity(dependencies, actor, {
      ...VALID_COMMAND,
      fragment: { content: "Lives in the Shire.", status: "USER_NOTE", boundary: fragmentBoundary },
    });

    expect(await storage.readStoredFragmentsOfEntity(GENERATED_ENTITY_ID)).toEqual([
      { content: "Lives in the Shire.", status: "USER_NOTE", revealedAt: ownUnits[1] },
    ]);
  });

  it.each([
    ["an empty content", ""],
    ["a content of only whitespace", "  \n\t "],
  ])(
    "stores the entity alone for %s, without validating or looking up the status and boundary of the fragment",
    async (_description, content) => {
      const { storage, dependencies, lookups } = await setUp();
      const entityIds = [
        "00000000-0000-4000-8000-0000000000e1",
        "00000000-0000-4000-8000-0000000000e2",
        "00000000-0000-4000-8000-0000000000e3",
      ];
      const fragmentBoundaries = [
        { workId: "not-an-identifier", unitNumber: "1e3" },
        { workId: FOREIGN_WORK_ID, unitNumber: "1" },
        { workId: NONEXISTENT_ID, unitNumber: "1" },
      ];

      for (const [index, fragmentBoundary] of fragmentBoundaries.entries()) {
        await createEntity({ ...dependencies, generateEntityId: () => entityIds[index] ?? "" }, actor, {
          ...VALID_COMMAND,
          fragment: { content, status: "RUMOR", boundary: fragmentBoundary },
        });
      }

      expect(await storage.countStoredEntities()).toBe(3);
      expect(await storage.countStoredFragments()).toBe(0);
      // One lookup per creation: the boundary of the entity, never the one of the dropped fragment.
      expect(lookups.count).toBe(3);
    },
  );

  it("reports every failing field in one validation error, keyed by its input path, and stores nothing", async () => {
    const { storage, dependencies, lookups } = await setUp();

    const failure = await captureRejection(
      createEntity(dependencies, actor, {
        universeId: FIRST_UNIVERSE.id,
        name: "   ",
        type: "EVENT",
        boundary: { workId: "not-an-identifier", unitNumber: "1e3" },
        fragment: {
          content: "a".repeat(5001),
          boundary: { workId: "also-not-an-identifier", unitNumber: "+7" },
        },
      }),
    );

    expect(failure).toBeInstanceOf(ValidationError);
    expect(failure).toMatchObject({
      issues: [
        { field: "name", code: "NAME_REQUIRED" },
        { field: "type", code: "TYPE_INVALID" },
        { field: "boundary.workId", code: "ID_INVALID" },
        { field: "boundary.unitNumber", code: "UNIT_NUMBER_INVALID" },
        { field: "fragment.content", code: "CONTENT_TOO_LONG", maximumLength: 5000 },
        { field: "fragment.status", code: "STATUS_INVALID" },
        { field: "fragment.boundary.workId", code: "ID_INVALID" },
        { field: "fragment.boundary.unitNumber", code: "UNIT_NUMBER_INVALID" },
      ],
    });
    expect(lookups.count).toBe(0);
    await expectNothingStored(storage);
  });

  it.each([
    ["a name of 121 characters", { name: "a".repeat(121) }, "name", "NAME_TOO_LONG"],
    ["a type in lower case", { type: "character" }, "type", "TYPE_INVALID"],
    ["a missing unit number", { boundary: { workId: OWN_WORK_ID, unitNumber: " " } }, "boundary.unitNumber", "UNIT_NUMBER_REQUIRED"],
    ["a decimal unit number", { boundary: { workId: OWN_WORK_ID, unitNumber: "7.0" } }, "boundary.unitNumber", "UNIT_NUMBER_INVALID"],
    [
      "a fragment without a status",
      { fragment: { content: "Note." } },
      "fragment.status",
      "STATUS_INVALID",
    ],
    [
      "a fragment with an unknown status",
      { fragment: { content: "Note.", status: "RUMOR" } },
      "fragment.status",
      "STATUS_INVALID",
    ],
    [
      "a fragment with a null character",
      { fragment: { content: "No\u0000te.", status: "USER_NOTE" } },
      "fragment.content",
      "CONTENT_INVALID_CHARACTERS",
    ],
  ])("refuses %s with that field alone and stores nothing", async (_label, change, field, code) => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(createEntity(dependencies, actor, { ...VALID_COMMAND, ...change }));

    expect(failure).toBeInstanceOf(ValidationError);
    // An array in `toMatchObject` must have the same length: this is the only issue.
    expect(failure).toMatchObject({ issues: [{ field, code }] });
    await expectNothingStored(storage);
  });

  it("accepts a name of 120 characters and a fragment of 5000", async () => {
    const { storage, dependencies } = await setUp();

    await createEntity(dependencies, actor, {
      ...VALID_COMMAND,
      name: "a".repeat(120),
      fragment: { content: "b".repeat(5000), status: "SPECULATION" },
    });

    expect(await storage.readStoredFragmentsOfEntity(GENERATED_ENTITY_ID)).toHaveLength(1);
  });

  it("gives the same not found error for a universe of another account and for a nonexistent one, storing nothing", async () => {
    const { storage, dependencies } = await setUp();

    const foreignFailure = await captureRejection(
      createEntity(dependencies, actor, {
        ...VALID_COMMAND,
        universeId: SECOND_OWNER_UNIVERSE.id,
        boundary: { workId: FOREIGN_WORK_ID, unitNumber: "1" },
      }),
    );
    const nonexistentFailure = await captureRejection(
      createEntity(dependencies, actor, { ...VALID_COMMAND, universeId: NONEXISTENT_ID }),
    );

    expect(foreignFailure).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(foreignFailure).toEqual(nonexistentFailure);
    await expectNothingStored(storage);
  });

  it("checks the universe before the fields, so invalid fields in a foreign universe still give not found", async () => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(
      createEntity(dependencies, actor, {
        universeId: SECOND_OWNER_UNIVERSE.id,
        name: "",
        type: "",
        boundary: { workId: "", unitNumber: "" },
      }),
    );

    expect(failure).toBeInstanceOf(KnowledgeItemNotFoundError);
    await expectNothingStored(storage);
  });

  it("rejects a malformed universe identifier as a validation error on universeId and stores nothing", async () => {
    const { storage, dependencies } = await setUp();

    const failure = await captureRejection(
      createEntity(dependencies, actor, { ...VALID_COMMAND, universeId: "not-a-uuid" }),
    );

    expect(failure).toMatchObject({ issues: [{ field: "universeId", code: "UNIVERSE_ID_INVALID" }] });
    await expectNothingStored(storage);
  });

  it("gives one and the same not found error for every boundary that names no unit of a work of the universe, storing nothing", async () => {
    const { storage, dependencies } = await setUp();
    const badBoundaries = [
      { workId: NONEXISTENT_ID, unitNumber: "1" },
      { workId: FOREIGN_WORK_ID, unitNumber: "1" },
      { workId: OTHER_UNIVERSE_WORK_ID, unitNumber: "1" },
      { workId: OWN_WORK_ID, unitNumber: "0" },
      { workId: OWN_WORK_ID, unitNumber: "4" },
      { workId: OWN_WORK_ID, unitNumber: "99999999999999999999" },
    ];

    const failures: unknown[] = [];
    for (const badBoundary of badBoundaries) {
      failures.push(await captureRejection(createEntity(dependencies, actor, { ...VALID_COMMAND, boundary: badBoundary })));
      failures.push(
        await captureRejection(
          createEntity(dependencies, actor, {
            ...VALID_COMMAND,
            fragment: { content: "Note.", status: "USER_NOTE", boundary: badBoundary },
          }),
        ),
      );
    }

    expect(failures).toHaveLength(badBoundaries.length * 2);
    for (const failure of failures) {
      expect(failure).toBeInstanceOf(KnowledgeItemNotFoundError);
      expect(failure).toEqual(new KnowledgeItemNotFoundError());
    }
    await expectNothingStored(storage);
  });

  it("names the oldest entity of the same type with the same comparable name, and still creates the new one", async () => {
    const { storage, dependencies, ownUnits } = await setUp();
    await storage.entityRepository.add(
      buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d2",
        name: "FRODO",
        normalizedName: "frodo",
        introducedAt: ownUnits[0],
        createdAt: new Date("2026-04-02T10:00:00.000Z"),
      }),
    );
    await storage.entityRepository.add(
      buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d3",
        name: "Frodo",
        normalizedName: "frodo",
        introducedAt: ownUnits[0],
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
      }),
    );

    const creation = await createEntity(dependencies, actor, { ...VALID_COMMAND, name: "  frodo " });

    expect(creation.similarEntityName).toBe("Frodo");
    expect(await storage.countStoredEntities()).toBe(3);
  });

  it("gives the notice for a name that differs only in case, accents or spacing", async () => {
    const { storage, dependencies } = await setUp();
    await createEntity(dependencies, actor, { ...VALID_COMMAND, name: "Éowyn  of Rohan" });

    const creation = await createEntity(
      { ...dependencies, generateEntityId: () => "00000000-0000-4000-8000-0000000000e2" },
      actor,
      { ...VALID_COMMAND, name: "EOWYN OF ROHAN" },
    );

    expect(creation.similarEntityName).toBe("Éowyn  of Rohan");
    expect(await storage.countStoredEntities()).toBe(2);
  });

  it("gives no notice for the same name with another type, nor for a name used only in another account's universe", async () => {
    const { dependencies } = await setUp();
    await createEntity(dependencies, actor, { ...VALID_COMMAND, name: "Rivendell", type: "LOCATION" });
    await createEntity(
      { ...dependencies, generateEntityId: () => "00000000-0000-4000-8000-0000000000e3" },
      buildActingUser(SECOND_OWNER_UNIVERSE.ownerId),
      {
        ...VALID_COMMAND,
        universeId: SECOND_OWNER_UNIVERSE.id,
        name: "Gandalf",
        boundary: { workId: FOREIGN_WORK_ID, unitNumber: "1" },
      },
    );

    const otherTypeCreation = await createEntity(
      { ...dependencies, generateEntityId: () => "00000000-0000-4000-8000-0000000000e4" },
      actor,
      { ...VALID_COMMAND, name: "Rivendell", type: "ORGANIZATION" },
    );
    const otherAccountNameCreation = await createEntity(
      { ...dependencies, generateEntityId: () => "00000000-0000-4000-8000-0000000000e5" },
      actor,
      { ...VALID_COMMAND, name: "Gandalf" },
    );

    expect(otherTypeCreation.similarEntityName).toBeNull();
    expect(otherAccountNameCreation.similarEntityName).toBeNull();
  });

  it("ignores attributes, a description, an owner, an identifier or any other data that travels with the command", async () => {
    const { storage, dependencies, ownUnits } = await setUp();
    const commandWithExtraData = {
      ...VALID_COMMAND,
      id: NONEXISTENT_ID,
      ownerId: SECOND_OWNER_UNIVERSE.ownerId,
      attributes: { power: 9000 },
      description: "A hobbit.",
      boundary: { ...VALID_COMMAND.boundary, unitId: NONEXISTENT_ID },
      fragment: { content: "Note.", status: "USER_NOTE", id: NONEXISTENT_ID, universeId: SECOND_OWNER_UNIVERSE.id },
    };

    const creation = await createEntity(dependencies, actor, commandWithExtraData);

    expect(creation.entity.id).toBe(GENERATED_ENTITY_ID);
    expect(Object.keys(creation.entity).sort()).toEqual(["createdAt", "id", "name", "type"]);
    expect(await storage.entityRepository.findAllInUniverse(buildViewerContext())).toEqual([
      {
        id: GENERATED_ENTITY_ID,
        universeId: FIRST_UNIVERSE.id,
        type: "CHARACTER",
        name: "Frodo",
        introducedAt: ownUnits[1],
        createdAt: CREATION_TIME,
        updatedAt: CREATION_TIME,
      },
    ]);
    expect(await storage.readStoredFragmentsOfEntity(GENERATED_ENTITY_ID)).toEqual([
      { content: "Note.", status: "USER_NOTE", revealedAt: ownUnits[1] },
    ]);
  });

  it("stores nothing and fails with the infrastructure error when the fragment cannot be stored", async () => {
    const { storage, dependencies } = await setUp();
    await storage.makeFragmentWritesFail();

    const failure = await captureRejection(
      createEntity(dependencies, actor, { ...VALID_COMMAND, fragment: { content: "Note.", status: "USER_NOTE" } }),
    );

    await storage.restoreFragmentWrites();
    expect(failure).toBeInstanceOf(InfrastructureError);
    await expectNothingStored(storage);
  });
});
