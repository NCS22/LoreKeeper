import { describe, expect, it } from "vitest";
import type { Universe } from "@/modules/universes/domain/universe";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import {
  buildNewEntity,
  buildNewRelationship,
  buildNewWork,
  buildNumberedTestUnits,
} from "../knowledge-repository-factories";
import { SECOND_UNIVERSE_OF_FIRST_OWNER, storeWorkWithBoundaries } from "./entity-repository-contract";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  type KnowledgeStorage,
  type KnowledgeStorageFactory,
  SECOND_OWNER_UNIVERSE,
} from "./work-repository-contract";

export const FRODO_ID = "00000000-0000-4000-8000-0000000000d1";
export const FELLOWSHIP_ID = "00000000-0000-4000-8000-0000000000d2";
export const SAM_ID = "00000000-0000-4000-8000-0000000000d3";
export const FOREIGN_ENTITY_ID = "00000000-0000-4000-8000-0000000000d8";
export const SECOND_FOREIGN_ENTITY_ID = "00000000-0000-4000-8000-0000000000d7";
export const OTHER_UNIVERSE_ENTITY_ID = "00000000-0000-4000-8000-0000000000d9";
export const OWN_WORK_ID = "00000000-0000-4000-8000-0000000000a0";
export const SECOND_OWN_WORK_ID = "00000000-0000-4000-8000-0000000000a1";
export const FOREIGN_WORK_ID = "00000000-0000-4000-8000-0000000000a9";
export const OTHER_UNIVERSE_WORK_ID = "00000000-0000-4000-8000-0000000000a8";

/** The identifier of the type with that key in the catalog of the universe. */
export async function findRelationshipTypeId(
  storage: KnowledgeStorage,
  universe: Universe,
  relationshipTypeKey: string,
): Promise<string> {
  const relationshipTypes = await storage.relationshipTypeCatalog.listRelationshipTypes(buildViewerContext(universe));
  const relationshipType = relationshipTypes.find((candidate) => candidate.key === relationshipTypeKey);
  if (relationshipType === undefined) {
    throw new Error(`The universe of the test has no type ${relationshipTypeKey}.`);
  }
  return relationshipType.id;
}

/**
 * Three universes and their items: in the first one, a novel of three units, a series of two
 * episodes and the entities Frodo, The Fellowship and Sam; in the universe of another account and
 * in a second universe of the first account, a work and one entity each (two in the foreign one).
 */
export async function storeRelationshipWorld(storage: KnowledgeStorage) {
  const ownUnits = await storeWorkWithBoundaries(storage, buildNewWork({ units: buildNumberedTestUnits(3) }));
  const secondWorkUnits = await storeWorkWithBoundaries(
    storage,
    buildNewWork({ id: SECOND_OWN_WORK_ID, title: "The Series", medium: "TV_SERIES", units: buildNumberedTestUnits(2) }),
  );
  const foreignUnits = await storeWorkWithBoundaries(
    storage,
    buildNewWork({ id: FOREIGN_WORK_ID, universeId: SECOND_OWNER_UNIVERSE.id, units: buildNumberedTestUnits(3) }),
  );
  const otherUniverseUnits = await storeWorkWithBoundaries(
    storage,
    buildNewWork({
      id: OTHER_UNIVERSE_WORK_ID,
      universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
      units: buildNumberedTestUnits(3),
    }),
  );
  const [firstUnit, secondUnit, thirdUnit] = ownUnits as [SpoilerBoundary, SpoilerBoundary, SpoilerBoundary];
  await storage.entityRepository.add(
    buildNewEntity({ id: FRODO_ID, name: "Frodo", normalizedName: "frodo", introducedAt: secondUnit }),
  );
  await storage.entityRepository.add(
    buildNewEntity({
      id: FELLOWSHIP_ID,
      type: "ORGANIZATION",
      name: "The Fellowship",
      normalizedName: "the fellowship",
      introducedAt: thirdUnit,
    }),
  );
  await storage.entityRepository.add(
    buildNewEntity({ id: SAM_ID, name: "Sam", normalizedName: "sam", introducedAt: firstUnit }),
  );
  await storage.entityRepository.add(
    buildNewEntity({
      id: FOREIGN_ENTITY_ID,
      universeId: SECOND_OWNER_UNIVERSE.id,
      name: "Foreign",
      normalizedName: "foreign",
      introducedAt: foreignUnits[0] as SpoilerBoundary,
    }),
  );
  await storage.entityRepository.add(
    buildNewEntity({
      id: SECOND_FOREIGN_ENTITY_ID,
      universeId: SECOND_OWNER_UNIVERSE.id,
      name: "Second foreign",
      normalizedName: "second foreign",
      introducedAt: foreignUnits[0] as SpoilerBoundary,
    }),
  );
  await storage.entityRepository.add(
    buildNewEntity({
      id: OTHER_UNIVERSE_ENTITY_ID,
      universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
      name: "Elsewhere",
      normalizedName: "elsewhere",
      introducedAt: otherUniverseUnits[0] as SpoilerBoundary,
    }),
  );
  return {
    firstUnit,
    secondUnit,
    thirdUnit,
    secondWorkUnits,
    foreignUnits,
    otherUniverseUnits,
    memberOfTypeId: await findRelationshipTypeId(storage, FIRST_UNIVERSE, "MEMBER_OF"),
    allyOfTypeId: await findRelationshipTypeId(storage, FIRST_UNIVERSE, "ALLY_OF"),
    foreignMemberOfTypeId: await findRelationshipTypeId(storage, SECOND_OWNER_UNIVERSE, "MEMBER_OF"),
    otherUniverseMemberOfTypeId: await findRelationshipTypeId(storage, SECOND_UNIVERSE_OF_FIRST_OWNER, "MEMBER_OF"),
  };
}

/**
 * The scenarios every storage of relationships must satisfy, the fake and PostgreSQL alike
 * (NFR-1): one stored relationship read from both of its entities, the order, the scope by
 * universe, and the refusals of the database constraints (an entity related to itself, and any
 * entity, type or boundary of another universe or unit of another work).
 */
export function describeRelationshipStorageContract(
  description: string,
  createStorage: KnowledgeStorageFactory,
): void {
  describe(`relationship storage contract: ${description}`, () => {
    async function setUp() {
      const storage = await createStorage([FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER]);
      return { storage, world: await storeRelationshipWorld(storage) };
    }

    it("stores one relationship and lists it from both of its entities, with their names and its point", async () => {
      const { storage, world } = await setUp();
      const newRelationship = buildNewRelationship({
        sourceEntityId: FRODO_ID,
        targetEntityId: FELLOWSHIP_ID,
        relationshipTypeId: world.memberOfTypeId,
        status: "CONFIRMED",
        revealedAt: world.secondUnit,
      });

      await storage.relationshipRepository.add(newRelationship);

      const expectedRelationship = {
        id: newRelationship.id,
        relationshipTypeId: world.memberOfTypeId,
        status: "CONFIRMED",
        source: { id: FRODO_ID, name: "Frodo" },
        target: { id: FELLOWSHIP_ID, name: "The Fellowship" },
        revealedAt: { workId: OWN_WORK_ID, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "2" },
        createdAt: newRelationship.createdAt,
      };
      const viewerContext = buildViewerContext();
      expect(await storage.relationshipRepository.findAllOfEntity(viewerContext, FRODO_ID)).toEqual([
        expectedRelationship,
      ]);
      expect(await storage.relationshipRepository.findAllOfEntity(viewerContext, FELLOWSHIP_ID)).toEqual([
        expectedRelationship,
      ]);
      expect(await storage.countStoredRelationships()).toBe(1);
    });

    it("lists the relationships of an entity oldest first, ties by identifier, and none of other entities", async () => {
      const { storage, world } = await setUp();
      const sameInstant = new Date("2026-03-05T10:00:00.000Z");
      const relationships = [
        buildNewRelationship({
          id: "00000000-0000-4000-8000-0000000000c1",
          sourceEntityId: FELLOWSHIP_ID,
          targetEntityId: FRODO_ID,
          relationshipTypeId: world.allyOfTypeId,
          revealedAt: world.firstUnit,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
        }),
        buildNewRelationship({
          id: "00000000-0000-4000-8000-0000000000c3",
          sourceEntityId: FRODO_ID,
          targetEntityId: SAM_ID,
          relationshipTypeId: world.allyOfTypeId,
          revealedAt: world.firstUnit,
          createdAt: sameInstant,
        }),
        buildNewRelationship({
          id: "00000000-0000-4000-8000-0000000000c2",
          sourceEntityId: FRODO_ID,
          targetEntityId: FELLOWSHIP_ID,
          relationshipTypeId: world.memberOfTypeId,
          revealedAt: world.firstUnit,
          createdAt: sameInstant,
        }),
        buildNewRelationship({
          id: "00000000-0000-4000-8000-0000000000c4",
          sourceEntityId: SAM_ID,
          targetEntityId: FELLOWSHIP_ID,
          relationshipTypeId: world.memberOfTypeId,
          revealedAt: world.firstUnit,
          createdAt: new Date("2026-03-01T10:00:00.000Z"),
        }),
      ];
      for (const newRelationship of relationships) {
        await storage.relationshipRepository.add(newRelationship);
      }

      const listedRelationships = await storage.relationshipRepository.findAllOfEntity(buildViewerContext(), FRODO_ID);

      expect(listedRelationships.map((relationship) => relationship.id)).toEqual([
        "00000000-0000-4000-8000-0000000000c2",
        "00000000-0000-4000-8000-0000000000c3",
        "00000000-0000-4000-8000-0000000000c1",
      ]);
    });

    it("lists only the relationships of the universe of the context, never those of another account's universe", async () => {
      const { storage, world } = await setUp();
      await storage.relationshipRepository.add(
        buildNewRelationship({
          universeId: SECOND_OWNER_UNIVERSE.id,
          sourceEntityId: FOREIGN_ENTITY_ID,
          targetEntityId: SECOND_FOREIGN_ENTITY_ID,
          relationshipTypeId: world.foreignMemberOfTypeId,
          revealedAt: world.foreignUnits[0] as SpoilerBoundary,
        }),
      );

      const seenByFirstOwner = await storage.relationshipRepository.findAllOfEntity(
        buildViewerContext(),
        FOREIGN_ENTITY_ID,
      );
      const seenBySecondOwner = await storage.relationshipRepository.findAllOfEntity(
        buildViewerContext(SECOND_OWNER_UNIVERSE),
        FOREIGN_ENTITY_ID,
      );

      expect(seenByFirstOwner).toEqual([]);
      expect(seenBySecondOwner.map((relationship) => relationship.target.name)).toEqual(["Second foreign"]);
    });

    it("refuses a relationship from an entity to itself, storing nothing", async () => {
      const { storage, world } = await setUp();

      await expect(
        storage.relationshipRepository.add(
          buildNewRelationship({
            sourceEntityId: FRODO_ID,
            targetEntityId: FRODO_ID,
            relationshipTypeId: world.allyOfTypeId,
            revealedAt: world.firstUnit,
          }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredRelationships()).toBe(0);
    });

    it.each([
      ["a source of another account's universe", { sourceEntityId: FOREIGN_ENTITY_ID }],
      ["a target of another account's universe", { targetEntityId: FOREIGN_ENTITY_ID }],
      ["a source of another universe of the same account", { sourceEntityId: OTHER_UNIVERSE_ENTITY_ID }],
      ["a target of another universe of the same account", { targetEntityId: OTHER_UNIVERSE_ENTITY_ID }],
    ])("refuses a relationship with %s, storing nothing", async (_description, entityOverride) => {
      const { storage, world } = await setUp();

      await expect(
        storage.relationshipRepository.add(
          buildNewRelationship({
            sourceEntityId: FRODO_ID,
            targetEntityId: FELLOWSHIP_ID,
            relationshipTypeId: world.memberOfTypeId,
            revealedAt: world.firstUnit,
            ...entityOverride,
          }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredRelationships()).toBe(0);
    });

    it.each([
      ["a type of another account's universe", "foreignMemberOfTypeId"],
      ["a type of another universe of the same account", "otherUniverseMemberOfTypeId"],
    ] as const)("refuses a relationship with %s, storing nothing", async (_description, typeName) => {
      const { storage, world } = await setUp();

      await expect(
        storage.relationshipRepository.add(
          buildNewRelationship({
            sourceEntityId: FRODO_ID,
            targetEntityId: FELLOWSHIP_ID,
            relationshipTypeId: world[typeName],
            revealedAt: world.firstUnit,
          }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredRelationships()).toBe(0);
    });

    it("refuses a relationship whose boundary is outside the universe or pairs a work with a unit of another work, storing nothing", async () => {
      const { storage, world } = await setUp();
      const badBoundaries: SpoilerBoundary[] = [
        world.foreignUnits[0] as SpoilerBoundary,
        world.otherUniverseUnits[0] as SpoilerBoundary,
        { workId: OWN_WORK_ID, unitId: (world.secondWorkUnits[0] as SpoilerBoundary).unitId },
      ];

      for (const badBoundary of badBoundaries) {
        await expect(
          storage.relationshipRepository.add(
            buildNewRelationship({
              sourceEntityId: FRODO_ID,
              targetEntityId: FELLOWSHIP_ID,
              relationshipTypeId: world.memberOfTypeId,
              revealedAt: badBoundary,
            }),
          ),
        ).rejects.toBeInstanceOf(InfrastructureError);
      }
      expect(await storage.countStoredRelationships()).toBe(0);
    });
  });
}
