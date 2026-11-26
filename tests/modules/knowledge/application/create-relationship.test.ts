import { describe, expect, it } from "vitest";
import {
  createRelationship,
  type CreateRelationshipCommand,
} from "@/modules/knowledge/application/create-relationship";
import type { RelationshipTypeCatalog } from "@/modules/knowledge/application/relationship-type-catalog";
import type { EntityRepository } from "@/modules/knowledge/domain/entity-repository";
import {
  KnowledgeItemNotFoundError,
  RelationshipToItselfError,
} from "@/modules/knowledge/domain/knowledge-errors";
import type { WorkRepository } from "@/modules/knowledge/domain/work-repository";
import { ValidationError } from "@/shared/domain/validation-error";
import { SECOND_UNIVERSE_OF_FIRST_OWNER } from "../../../support/contracts/entity-repository-contract";
import {
  FELLOWSHIP_ID,
  FOREIGN_ENTITY_ID,
  FOREIGN_WORK_ID,
  FRODO_ID,
  OTHER_UNIVERSE_ENTITY_ID,
  OTHER_UNIVERSE_WORK_ID,
  OWN_WORK_ID,
  SAM_ID,
  SECOND_OWN_WORK_ID,
  storeRelationshipWorld,
} from "../../../support/contracts/relationship-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  type KnowledgeStorage,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import { knowledgeStorageFactories } from "../../../support/knowledge-repository-factories";
import { buildActingUser, FIRST_OWNER_ID } from "../../../support/universe-owners";

const NONEXISTENT_ID = "00000000-0000-4000-8000-0000000000ff";
const GENERATED_RELATIONSHIP_IDS = [
  "00000000-0000-4000-8000-0000000000c1",
  "00000000-0000-4000-8000-0000000000c2",
  "00000000-0000-4000-8000-0000000000c3",
];
const CREATION_TIME = new Date("2026-05-01T12:00:00.000Z");

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

/** Counts every lookup of an entity, a unit and the catalog the use case asks for. */
function countLookups(storage: KnowledgeStorage) {
  const lookups = { count: 0 };
  const countingEntityRepository: EntityRepository = {
    ...storage.entityRepository,
    findInUniverse: (viewerContext, entityId) => {
      lookups.count += 1;
      return storage.entityRepository.findInUniverse(viewerContext, entityId);
    },
  };
  const countingWorkRepository: WorkRepository = {
    ...storage.workRepository,
    findBoundaryOfUnitNumber: (viewerContext, workId, unitNumber) => {
      lookups.count += 1;
      return storage.workRepository.findBoundaryOfUnitNumber(viewerContext, workId, unitNumber);
    },
  };
  const countingCatalog: RelationshipTypeCatalog = {
    listRelationshipTypes: (viewerContext) => {
      lookups.count += 1;
      return storage.relationshipTypeCatalog.listRelationshipTypes(viewerContext);
    },
  };
  return { lookups, countingEntityRepository, countingWorkRepository, countingCatalog };
}

describe.each(knowledgeStorageFactories)("createRelationship: %s", (_name, createStorage) => {
  const actor = buildActingUser(FIRST_OWNER_ID);

  async function setUp() {
    const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER]);
    const world = await storeRelationshipWorld(storage);
    const { lookups, countingEntityRepository, countingWorkRepository, countingCatalog } = countLookups(storage);
    const remainingIds = [...GENERATED_RELATIONSHIP_IDS];
    const dependencies = {
      ownUniverseLookup: storage.ownUniverseLookup,
      workRepository: countingWorkRepository,
      entityRepository: countingEntityRepository,
      relationshipRepository: storage.relationshipRepository,
      relationshipTypeCatalog: countingCatalog,
      generateRelationshipId: () => remainingIds.shift() ?? NONEXISTENT_ID,
      getCurrentTime: () => CREATION_TIME,
    };
    const validCommand: CreateRelationshipCommand = {
      universeId: FIRST_UNIVERSE.id,
      sourceEntityId: FRODO_ID,
      targetEntityId: FELLOWSHIP_ID,
      relationshipTypeId: world.memberOfTypeId,
      status: "CONFIRMED",
      boundary: { workId: OWN_WORK_ID, unitNumber: "2" },
    };
    return { storage, world, dependencies, lookups, validCommand };
  }

  async function expectNothingStored(storage: KnowledgeStorage): Promise<void> {
    expect(await storage.countStoredRelationships()).toBe(0);
  }

  it("stores one relationship with its type, status and point, and returns it with its two entities", async () => {
    const { storage, world, dependencies, validCommand } = await setUp();

    const createdRelationship = await createRelationship(dependencies, actor, validCommand);

    expect(createdRelationship).toEqual({
      id: GENERATED_RELATIONSHIP_IDS[0],
      sourceEntityId: FRODO_ID,
      targetEntityId: FELLOWSHIP_ID,
    });
    expect(await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FELLOWSHIP_ID)).toEqual([
      {
        id: GENERATED_RELATIONSHIP_IDS[0],
        relationshipTypeId: world.memberOfTypeId,
        status: "CONFIRMED",
        source: { id: FRODO_ID, name: "Frodo" },
        target: { id: FELLOWSHIP_ID, name: "The Fellowship" },
        revealedAt: { workId: OWN_WORK_ID, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "2" },
        createdAt: CREATION_TIME,
      },
    ]);
    expect(await storage.countStoredRelationships()).toBe(1);
  });

  it("ignores spaces around the unit number and its leading zeros, and accepts identifiers in upper case", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    const createdRelationship = await createRelationship(dependencies, actor, {
      ...validCommand,
      sourceEntityId: FRODO_ID.toUpperCase(),
      boundary: { workId: OWN_WORK_ID.toUpperCase(), unitNumber: " 003 " },
    });

    expect(createdRelationship.sourceEntityId).toBe(FRODO_ID);
    const [storedRelationship] = await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID);
    expect(storedRelationship?.revealedAt.unitLabel).toBe("3");
  });

  it.each([
    ["two nonexistent identifiers", NONEXISTENT_ID, NONEXISTENT_ID],
    ["an own entity", FRODO_ID, FRODO_ID],
    ["an own entity written once in upper case", FRODO_ID, FRODO_ID.toUpperCase()],
  ])(
    "refuses a relationship from an entity to itself (%s) with the business rule error before any lookup, storing nothing",
    async (_description, sourceEntityId, targetEntityId) => {
      const { storage, dependencies, lookups, validCommand } = await setUp();

      const error = await captureRejection(
        createRelationship(dependencies, actor, { ...validCommand, sourceEntityId, targetEntityId }),
      );

      expect(error).toBeInstanceOf(RelationshipToItselfError);
      expect(lookups.count).toBe(0);
      await expectNothingStored(storage);
    },
  );

  it("reports every failing field in one validation error, keyed by its input path, and stores nothing", async () => {
    const { storage, dependencies, lookups } = await setUp();

    const error = await captureRejection(
      createRelationship(dependencies, actor, {
        universeId: FIRST_UNIVERSE.id,
        sourceEntityId: "not-an-identifier",
        targetEntityId: "",
        relationshipTypeId: "MEMBER_OF",
        status: "MAYBE",
        boundary: { workId: "work", unitNumber: "1e3" },
      }),
    );

    expect(error).toBeInstanceOf(ValidationError);
    expect(error instanceof ValidationError && error.issues).toEqual([
      { field: "sourceEntityId", code: "ID_INVALID" },
      { field: "targetEntityId", code: "ID_INVALID" },
      { field: "relationshipTypeId", code: "ID_INVALID" },
      { field: "status", code: "STATUS_INVALID" },
      { field: "boundary.workId", code: "ID_INVALID" },
      { field: "boundary.unitNumber", code: "UNIT_NUMBER_INVALID" },
    ]);
    expect(lookups.count).toBe(0);
    await expectNothingStored(storage);
  });

  it.each([
    ["a malformed source", { sourceEntityId: "frodo" }, "sourceEntityId", "ID_INVALID"],
    ["a malformed target", { targetEntityId: "fellowship" }, "targetEntityId", "ID_INVALID"],
    ["a malformed type", { relationshipTypeId: "MEMBER_OF" }, "relationshipTypeId", "ID_INVALID"],
    ["no status", { status: undefined }, "status", "STATUS_INVALID"],
    ["a null status", { status: null }, "status", "STATUS_INVALID"],
    ["an unknown status", { status: "RUMOUR" }, "status", "STATUS_INVALID"],
    ["a status in lower case", { status: "confirmed" }, "status", "STATUS_INVALID"],
    ["a malformed work", { boundary: { workId: "novel", unitNumber: "2" } }, "boundary.workId", "ID_INVALID"],
    ["an empty unit number", { boundary: { workId: OWN_WORK_ID, unitNumber: "  " } }, "boundary.unitNumber", "UNIT_NUMBER_REQUIRED"],
    ["a unit number with a sign", { boundary: { workId: OWN_WORK_ID, unitNumber: "+2" } }, "boundary.unitNumber", "UNIT_NUMBER_INVALID"],
  ] as const)(
    "reports %s as the only validation issue and stores nothing",
    async (_description, commandOverride, field, code) => {
      const { storage, dependencies, validCommand } = await setUp();

      const error = await captureRejection(createRelationship(dependencies, actor, { ...validCommand, ...commandOverride }));

      expect(error instanceof ValidationError && error.issues).toEqual([{ field, code }]);
      await expectNothingStored(storage);
    },
  );

  it("checks the fields before the rule of an entity related to itself", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    const error = await captureRejection(
      createRelationship(dependencies, actor, { ...validCommand, targetEntityId: FRODO_ID, status: "RUMOUR" }),
    );

    expect(error instanceof ValidationError && error.issues).toEqual([{ field: "status", code: "STATUS_INVALID" }]);
    await expectNothingStored(storage);
  });

  it("gives the same not found error for a universe of another account and for a nonexistent one, storing nothing", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    const foreignError = await captureRejection(
      createRelationship(dependencies, actor, { ...validCommand, universeId: SECOND_OWNER_UNIVERSE.id }),
    );
    const nonexistentError = await captureRejection(
      createRelationship(dependencies, actor, { ...validCommand, universeId: NONEXISTENT_ID }),
    );

    expect(foreignError).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(nonexistentError).toBeInstanceOf(KnowledgeItemNotFoundError);
    expect(foreignError).toEqual(nonexistentError);
    await expectNothingStored(storage);
  });

  it("rejects a malformed universe identifier as a validation error on universeId and stores nothing", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    const error = await captureRejection(
      createRelationship(dependencies, actor, { ...validCommand, universeId: "not-an-identifier" }),
    );

    expect(error instanceof ValidationError && error.issues.map((issue) => issue.field)).toEqual(["universeId"]);
    await expectNothingStored(storage);
  });

  it("gives one and the same not found error for every source, target, type or point that is not of the universe, storing nothing", async () => {
    const { storage, world, dependencies, validCommand } = await setUp();
    const badReferences: ReadonlyArray<Partial<CreateRelationshipCommand>> = [
      { sourceEntityId: FOREIGN_ENTITY_ID },
      { sourceEntityId: OTHER_UNIVERSE_ENTITY_ID },
      { sourceEntityId: NONEXISTENT_ID },
      { targetEntityId: FOREIGN_ENTITY_ID },
      { targetEntityId: OTHER_UNIVERSE_ENTITY_ID },
      { targetEntityId: NONEXISTENT_ID },
      { relationshipTypeId: world.foreignMemberOfTypeId },
      { relationshipTypeId: world.otherUniverseMemberOfTypeId },
      { relationshipTypeId: NONEXISTENT_ID },
      { relationshipTypeId: SAM_ID },
      { boundary: { workId: FOREIGN_WORK_ID, unitNumber: "1" } },
      { boundary: { workId: OTHER_UNIVERSE_WORK_ID, unitNumber: "1" } },
      { boundary: { workId: NONEXISTENT_ID, unitNumber: "1" } },
      { boundary: { workId: OWN_WORK_ID, unitNumber: "0" } },
      { boundary: { workId: OWN_WORK_ID, unitNumber: "4" } },
      { boundary: { workId: SECOND_OWN_WORK_ID, unitNumber: "3" } },
      { boundary: { workId: OWN_WORK_ID, unitNumber: "99999999999999999999" } },
    ];

    const errors: unknown[] = [];
    for (const badReference of badReferences) {
      errors.push(await captureRejection(createRelationship(dependencies, actor, { ...validCommand, ...badReference })));
    }

    expect(errors).toHaveLength(badReferences.length);
    for (const error of errors) {
      expect(error).toBeInstanceOf(KnowledgeItemNotFoundError);
      expect(error).toEqual(new KnowledgeItemNotFoundError());
    }
    await expectNothingStored(storage);
  });

  it("accepts a point independent of the entities: earlier than their introduction and in another work", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    await createRelationship(dependencies, actor, {
      ...validCommand,
      boundary: { workId: SECOND_OWN_WORK_ID, unitNumber: "1" },
    });

    const [storedRelationship] = await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID);
    expect(storedRelationship?.revealedAt).toEqual({
      workId: SECOND_OWN_WORK_ID,
      workTitle: "The Series",
      workMedium: "TV_SERIES",
      unitLabel: "1",
    });
  });

  it("stores the same pair with the same type more than once, and in either direction", async () => {
    const { storage, dependencies, validCommand } = await setUp();

    await createRelationship(dependencies, actor, validCommand);
    await createRelationship(dependencies, actor, validCommand);
    await createRelationship(dependencies, actor, {
      ...validCommand,
      sourceEntityId: FELLOWSHIP_ID,
      targetEntityId: FRODO_ID,
    });

    const storedRelationships = await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID);
    expect(storedRelationships.map((relationship) => [relationship.id, relationship.source.id])).toEqual([
      [GENERATED_RELATIONSHIP_IDS[0], FRODO_ID],
      [GENERATED_RELATIONSHIP_IDS[1], FRODO_ID],
      [GENERATED_RELATIONSHIP_IDS[2], FELLOWSHIP_ID],
    ]);
  });

  it("ignores a description, an owner, an identifier or any other data that travels with the command", async () => {
    const { storage, world, dependencies, validCommand } = await setUp();
    const commandWithExtraData = {
      ...validCommand,
      id: NONEXISTENT_ID,
      ownerId: SECOND_OWNER_UNIVERSE.ownerId,
      description: "Joined at Rivendell.",
      createdAt: "2020-01-01T00:00:00.000Z",
      boundary: { ...validCommand.boundary, unitId: NONEXISTENT_ID },
    };

    const createdRelationship = await createRelationship(dependencies, actor, commandWithExtraData);

    expect(Object.keys(createdRelationship).sort()).toEqual(["id", "sourceEntityId", "targetEntityId"]);
    expect(await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID)).toEqual([
      {
        id: GENERATED_RELATIONSHIP_IDS[0],
        relationshipTypeId: world.memberOfTypeId,
        status: "CONFIRMED",
        source: { id: FRODO_ID, name: "Frodo" },
        target: { id: FELLOWSHIP_ID, name: "The Fellowship" },
        revealedAt: { workId: OWN_WORK_ID, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "2" },
        createdAt: CREATION_TIME,
      },
    ]);
  });
});
