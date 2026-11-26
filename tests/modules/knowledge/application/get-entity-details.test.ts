import { describe, expect, it } from "vitest";
import { getEntityDetails } from "@/modules/knowledge/application/get-entity-details";
import { KnowledgeItemNotFoundError } from "@/modules/knowledge/domain/knowledge-errors";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import { ValidationError } from "@/shared/domain/validation-error";
import { SECOND_UNIVERSE_OF_FIRST_OWNER } from "../../../support/contracts/entity-repository-contract";
import {
  FELLOWSHIP_ID,
  FOREIGN_ENTITY_ID,
  FRODO_ID,
  OTHER_UNIVERSE_ENTITY_ID,
  OWN_WORK_ID,
  SAM_ID,
  SECOND_OWN_WORK_ID,
  storeRelationshipWorld,
} from "../../../support/contracts/relationship-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  SECOND_OWNER_UNIVERSE,
} from "../../../support/contracts/work-repository-contract";
import {
  buildNewEntity,
  buildNewRelationship,
  knowledgeStorageFactories,
} from "../../../support/knowledge-repository-factories";

const GANDALF_ID = "00000000-0000-4000-8000-0000000000d4";
const NONEXISTENT_ID = "00000000-0000-4000-8000-0000000000ff";

async function captureRejection(operation: Promise<unknown>): Promise<unknown> {
  try {
    await operation;
  } catch (error) {
    return error;
  }
  throw new Error("Expected the operation to be rejected.");
}

describe.each(knowledgeStorageFactories)("getEntityDetails: %s", (_name, createStorage) => {
  async function setUp() {
    const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER]);
    const world = await storeRelationshipWorld(storage);
    const dependencies = {
      entityRepository: storage.entityRepository,
      relationshipRepository: storage.relationshipRepository,
      relationshipTypeCatalog: storage.relationshipTypeCatalog,
    };
    return { storage, world, dependencies };
  }

  it("shows the name, type, introduction point and first fragment, each point with the unit wording of its work", async () => {
    const { storage, world, dependencies } = await setUp();
    await storage.entityRepository.add(
      buildNewEntity({
        id: GANDALF_ID,
        name: "Gandalf",
        normalizedName: "gandalf",
        introducedAt: world.firstUnit,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f1",
          content: "A wizard.\nGrey, then white.",
          status: "CONFIRMED",
          revealedAt: world.secondWorkUnits[1] as SpoilerBoundary,
        },
      }),
    );

    expect(await getEntityDetails(dependencies, buildViewerContext(), GANDALF_ID)).toEqual({
      id: GANDALF_ID,
      name: "Gandalf",
      type: "CHARACTER",
      introducedAt: { workId: OWN_WORK_ID, workTitle: "My Novel", unitWording: "chapter", unitLabel: "1" },
      firstFragment: {
        content: "A wizard.\nGrey, then white.",
        status: "CONFIRMED",
        point: { workId: SECOND_OWN_WORK_ID, workTitle: "The Series", unitWording: "episode", unitLabel: "2" },
      },
      relationships: [],
    });
  });

  it("says there is no first fragment and no relationship for an entity without them", async () => {
    const { dependencies } = await setUp();

    const entityDetails = await getEntityDetails(dependencies, buildViewerContext(), SAM_ID);

    expect(entityDetails.firstFragment).toBeNull();
    expect(entityDetails.relationships).toEqual([]);
  });

  it("reads a relationship from the source with its label and from the target with its inverse label, with its status and point", async () => {
    const { storage, world, dependencies } = await setUp();
    await storage.relationshipRepository.add(
      buildNewRelationship({
        id: "00000000-0000-4000-8000-0000000000c1",
        sourceEntityId: FRODO_ID,
        targetEntityId: FELLOWSHIP_ID,
        relationshipTypeId: world.memberOfTypeId,
        status: "SPECULATION",
        revealedAt: world.thirdUnit,
      }),
    );
    const expectedPoint = { workId: OWN_WORK_ID, workTitle: "My Novel", unitWording: "chapter", unitLabel: "3" };

    const fromSource = await getEntityDetails(dependencies, buildViewerContext(), FRODO_ID);
    const fromTarget = await getEntityDetails(dependencies, buildViewerContext(), FELLOWSHIP_ID);

    expect(fromSource.relationships).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000c1",
        status: "SPECULATION",
        point: expectedPoint,
        subjectName: "Frodo",
        label: "member of",
        otherName: "The Fellowship",
      },
    ]);
    expect(fromTarget.relationships).toEqual([
      {
        id: "00000000-0000-4000-8000-0000000000c1",
        status: "SPECULATION",
        point: expectedPoint,
        subjectName: "The Fellowship",
        label: "has member",
        otherName: "Frodo",
      },
    ]);
  });

  it("reads a symmetric relationship with the same text from both entities", async () => {
    const { storage, world, dependencies } = await setUp();
    await storage.relationshipRepository.add(
      buildNewRelationship({
        sourceEntityId: SAM_ID,
        targetEntityId: FRODO_ID,
        relationshipTypeId: world.allyOfTypeId,
        revealedAt: world.firstUnit,
      }),
    );

    const [fromSource] = (await getEntityDetails(dependencies, buildViewerContext(), SAM_ID)).relationships;
    const [fromTarget] = (await getEntityDetails(dependencies, buildViewerContext(), FRODO_ID)).relationships;

    expect([fromSource?.subjectName, fromSource?.label, fromSource?.otherName]).toEqual(["Sam", "ally of", "Frodo"]);
    expect([fromTarget?.subjectName, fromTarget?.label, fromTarget?.otherName]).toEqual(["Frodo", "ally of", "Sam"]);
  });

  it("lists the relationships in creation order, ties by identifier, whichever side the entity is on", async () => {
    const { storage, world, dependencies } = await setUp();
    const sameInstant = new Date("2026-04-01T10:00:00.000Z");
    for (const [relationshipId, sourceEntityId, targetEntityId, createdAt] of [
      ["00000000-0000-4000-8000-0000000000c1", FELLOWSHIP_ID, FRODO_ID, new Date("2026-05-01T10:00:00.000Z")],
      ["00000000-0000-4000-8000-0000000000c3", FRODO_ID, SAM_ID, sameInstant],
      ["00000000-0000-4000-8000-0000000000c2", SAM_ID, FRODO_ID, sameInstant],
    ] as const) {
      await storage.relationshipRepository.add(
        buildNewRelationship({
          id: relationshipId,
          sourceEntityId,
          targetEntityId,
          relationshipTypeId: world.memberOfTypeId,
          revealedAt: world.firstUnit,
          createdAt,
        }),
      );
    }

    const entityDetails = await getEntityDetails(dependencies, buildViewerContext(), FRODO_ID);

    expect(
      entityDetails.relationships.map((relationship) => [relationship.id, relationship.label, relationship.otherName]),
    ).toEqual([
      ["00000000-0000-4000-8000-0000000000c2", "has member", "Sam"],
      ["00000000-0000-4000-8000-0000000000c3", "member of", "Sam"],
      ["00000000-0000-4000-8000-0000000000c1", "has member", "The Fellowship"],
    ]);
  });

  it("accepts the identifier of the entity in upper case", async () => {
    const { dependencies } = await setUp();

    const entityDetails = await getEntityDetails(dependencies, buildViewerContext(), FRODO_ID.toUpperCase());

    expect(entityDetails.id).toBe(FRODO_ID);
  });

  it("gives the same not found error for an entity of another account's universe, of another universe of the same account and a nonexistent one", async () => {
    const { dependencies } = await setUp();
    const viewerContext = buildViewerContext();

    const errors = [
      await captureRejection(getEntityDetails(dependencies, viewerContext, FOREIGN_ENTITY_ID)),
      await captureRejection(getEntityDetails(dependencies, viewerContext, OTHER_UNIVERSE_ENTITY_ID)),
      await captureRejection(getEntityDetails(dependencies, viewerContext, NONEXISTENT_ID)),
    ];

    for (const error of errors) {
      expect(error).toBeInstanceOf(KnowledgeItemNotFoundError);
      expect(error).toEqual(new KnowledgeItemNotFoundError());
    }
  });

  it("rejects a malformed entity identifier as a validation error on entityId", async () => {
    const { dependencies } = await setUp();

    const error = await captureRejection(getEntityDetails(dependencies, buildViewerContext(), "frodo"));

    expect(error instanceof ValidationError && error.issues).toEqual([{ field: "entityId", code: "ID_INVALID" }]);
  });

  it("fails with the infrastructure error when a relationship names a type the catalog of its universe does not hold", async () => {
    const { storage, world, dependencies } = await setUp();
    await storage.relationshipRepository.add(
      buildNewRelationship({
        sourceEntityId: FRODO_ID,
        targetEntityId: FELLOWSHIP_ID,
        relationshipTypeId: world.memberOfTypeId,
        revealedAt: world.firstUnit,
      }),
    );
    const emptyCatalog = { listRelationshipTypes: async () => [] };

    const error = await captureRejection(
      getEntityDetails({ ...dependencies, relationshipTypeCatalog: emptyCatalog }, buildViewerContext(), FRODO_ID),
    );

    expect(error).toBeInstanceOf(InfrastructureError);
  });
});
