import { describe, expect, it } from "vitest";
import type { Entity, NewEntity } from "@/modules/knowledge/domain/entity";
import type { NewWork } from "@/modules/knowledge/domain/work";
import type { Universe } from "@/modules/universes/domain/universe";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import { buildNewEntity, buildNewWork, buildNumberedTestUnits } from "../knowledge-repository-factories";
import {
  buildViewerContext,
  FIRST_UNIVERSE,
  type KnowledgeStorage,
  type KnowledgeStorageFactory,
  SECOND_OWNER_UNIVERSE,
} from "./work-repository-contract";

/** A second universe of the first account, to check references across universes of one owner. */
export const SECOND_UNIVERSE_OF_FIRST_OWNER: Universe = {
  ...FIRST_UNIVERSE,
  id: "00000000-0000-4000-8000-000000000002",
  name: "Second universe",
};

/** Stores the work and returns the boundary of each of its units, in order. */
export async function storeWorkWithBoundaries(
  storage: KnowledgeStorage,
  newWork: NewWork,
): Promise<SpoilerBoundary[]> {
  await storage.workRepository.add(newWork);
  const universe = [FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER].find(
    (candidate) => candidate.id === newWork.universeId,
  );
  const boundaries: SpoilerBoundary[] = [];
  for (let unitNumber = 1; unitNumber <= newWork.units.length; unitNumber += 1) {
    const boundary = await storage.workRepository.findBoundaryOfUnitNumber(
      buildViewerContext(universe),
      newWork.id,
      unitNumber,
    );
    if (boundary === null) {
      throw new Error("The work of the test was not stored with its units.");
    }
    boundaries.push(boundary);
  }
  return boundaries;
}

/** The entity as the repository lists it: without its comparable name and its fragment. */
function asListedEntity(newEntity: NewEntity): Entity {
  return {
    id: newEntity.id,
    universeId: newEntity.universeId,
    type: newEntity.type,
    name: newEntity.name,
    introducedAt: newEntity.introducedAt,
    createdAt: newEntity.createdAt,
    updatedAt: newEntity.updatedAt,
  };
}

/**
 * The scenarios every storage of entities must satisfy, the fake and PostgreSQL alike (NFR-1): the
 * entity stored with its first fragment or nothing, the order, the scope by universe, the refusal
 * of a boundary of another universe or a unit of another work, and the duplicate-name lookup.
 */
export function describeEntityStorageContract(
  description: string,
  createStorage: KnowledgeStorageFactory,
): void {
  describe(`entity storage contract: ${description}`, () => {
    const startingUniverses = [FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE, SECOND_UNIVERSE_OF_FIRST_OWNER];

    async function setUp() {
      const storage = await createStorage(startingUniverses);
      const [firstUnit, secondUnit, thirdUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ units: buildNumberedTestUnits(3) }),
      );
      return { storage, firstUnit, secondUnit, thirdUnit };
    }

    it("stores an entity without a fragment and lists it with its introduction point", async () => {
      const { storage, secondUnit } = await setUp();
      const newEntity = buildNewEntity({ introducedAt: secondUnit });

      await storage.entityRepository.add(newEntity);

      expect(await storage.entityRepository.findAllInUniverse(buildViewerContext())).toEqual([
        asListedEntity(newEntity),
      ]);
      expect(await storage.readStoredFragmentsOfEntity(newEntity.id)).toEqual([]);
    });

    it("stores an entity together with its first fragment at its own point", async () => {
      const { storage, firstUnit, thirdUnit } = await setUp();
      const newEntity = buildNewEntity({
        introducedAt: firstUnit,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f1",
          content: "Carries the ring.",
          status: "SPECULATION",
          revealedAt: thirdUnit,
        },
      });

      await storage.entityRepository.add(newEntity);

      expect(await storage.readStoredFragmentsOfEntity(newEntity.id)).toEqual([
        { content: "Carries the ring.", status: "SPECULATION", revealedAt: thirdUnit },
      ]);
      expect(await storage.entityRepository.findAllInUniverse(buildViewerContext())).toHaveLength(1);
    });

    it("lists the entities oldest first, and entities created at the same instant by identifier", async () => {
      const { storage, firstUnit } = await setUp();
      const sameInstant = new Date("2026-03-05T10:00:00.000Z");
      const entities = [
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000d1",
          name: "Newest",
          introducedAt: firstUnit,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        }),
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000e2",
          name: "Tied, higher identifier",
          introducedAt: firstUnit,
          createdAt: sameInstant,
          updatedAt: sameInstant,
        }),
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000e1",
          name: "Tied, lower identifier",
          introducedAt: firstUnit,
          createdAt: sameInstant,
          updatedAt: sameInstant,
        }),
      ];
      for (const newEntity of entities) {
        await storage.entityRepository.add(newEntity);
      }

      const listedEntities = await storage.entityRepository.findAllInUniverse(buildViewerContext());

      expect(listedEntities.map((entity) => entity.name)).toEqual([
        "Tied, lower identifier",
        "Tied, higher identifier",
        "Newest",
      ]);
    });

    it("lists only the entities of the universe of the context, never those of another account's universe", async () => {
      const { storage, firstUnit } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );
      await storage.entityRepository.add(buildNewEntity({ name: "Own", introducedAt: firstUnit }));
      await storage.entityRepository.add(
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000d9",
          universeId: SECOND_OWNER_UNIVERSE.id,
          name: "Foreign",
          introducedAt: foreignUnit,
        }),
      );

      const firstOwnerEntities = await storage.entityRepository.findAllInUniverse(buildViewerContext());
      const secondOwnerEntities = await storage.entityRepository.findAllInUniverse(
        buildViewerContext(SECOND_OWNER_UNIVERSE),
      );

      expect(firstOwnerEntities.map((entity) => entity.name)).toEqual(["Own"]);
      expect(secondOwnerEntities.map((entity) => entity.name)).toEqual(["Foreign"]);
    });

    it("stores neither the entity nor its fragment when the fragment cannot be stored", async () => {
      const { storage, firstUnit } = await setUp();
      const newEntity = buildNewEntity({
        introducedAt: firstUnit,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f1",
          content: "Never stored.",
          status: "USER_NOTE",
          revealedAt: firstUnit,
        },
      });
      await storage.makeFragmentWritesFail();

      await expect(storage.entityRepository.add(newEntity)).rejects.toBeInstanceOf(InfrastructureError);

      await storage.restoreFragmentWrites();
      expect(await storage.countStoredEntities()).toBe(0);
      expect(await storage.countStoredFragments()).toBe(0);
    });

    it("stores the entity with its fragment when it is added again after a failed attempt", async () => {
      const { storage, firstUnit } = await setUp();
      const newEntity = buildNewEntity({
        introducedAt: firstUnit,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f1",
          content: "Stored the second time.",
          status: "CONFIRMED",
          revealedAt: firstUnit,
        },
      });
      await storage.makeFragmentWritesFail();
      await expect(storage.entityRepository.add(newEntity)).rejects.toBeInstanceOf(InfrastructureError);
      await storage.restoreFragmentWrites();

      await storage.entityRepository.add(newEntity);

      expect(await storage.countStoredEntities()).toBe(1);
      expect(await storage.readStoredFragmentsOfEntity(newEntity.id)).toHaveLength(1);
    });

    it("refuses an entity whose boundary is a work of another account's universe, storing nothing", async () => {
      const { storage } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );

      await expect(
        storage.entityRepository.add(buildNewEntity({ introducedAt: foreignUnit })),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredEntities()).toBe(0);
    });

    it("refuses an entity whose boundary is a work of another universe of the same account, storing nothing", async () => {
      const { storage } = await setUp();
      const [otherUniverseUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({
          id: "00000000-0000-4000-8000-0000000000a8",
          universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
        }),
      );

      await expect(
        storage.entityRepository.add(buildNewEntity({ introducedAt: otherUniverseUnit })),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredEntities()).toBe(0);
    });

    it("refuses an entity whose boundary pairs a work with a unit of another work, storing nothing", async () => {
      const { storage, firstUnit } = await setUp();
      const [unitOfOtherWork] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a7", title: "Other work" }),
      );

      await expect(
        storage.entityRepository.add(
          buildNewEntity({ introducedAt: { workId: firstUnit.workId, unitId: unitOfOtherWork.unitId } }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredEntities()).toBe(0);
    });

    it("refuses a fragment whose boundary is outside the universe, storing neither the fragment nor the entity", async () => {
      const { storage, firstUnit } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );

      await expect(
        storage.entityRepository.add(
          buildNewEntity({
            introducedAt: firstUnit,
            firstFragment: {
              id: "00000000-0000-4000-8000-0000000000f1",
              content: "Points elsewhere.",
              status: "USER_NOTE",
              revealedAt: foreignUnit,
            },
          }),
        ),
      ).rejects.toBeInstanceOf(InfrastructureError);
      expect(await storage.countStoredEntities()).toBe(0);
      expect(await storage.countStoredFragments()).toBe(0);
    });

    it("finds the name of the oldest entity of the same type and comparable name in the universe", async () => {
      const { storage, firstUnit } = await setUp();
      await storage.entityRepository.add(
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000d2",
          name: "FRODO",
          normalizedName: "frodo",
          introducedAt: firstUnit,
          createdAt: new Date("2026-04-02T10:00:00.000Z"),
          updatedAt: new Date("2026-04-02T10:00:00.000Z"),
        }),
      );
      await storage.entityRepository.add(
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000d3",
          name: "Frodo",
          normalizedName: "frodo",
          introducedAt: firstUnit,
          createdAt: new Date("2026-04-01T10:00:00.000Z"),
          updatedAt: new Date("2026-04-01T10:00:00.000Z"),
        }),
      );

      expect(
        await storage.entityRepository.findOldestNameOfSimilarEntity(buildViewerContext(), "CHARACTER", "frodo"),
      ).toBe("Frodo");
    });

    it("finds no similar entity of another type, with another comparable name or in another account's universe", async () => {
      const { storage, firstUnit } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );
      await storage.entityRepository.add(
        buildNewEntity({ name: "Rivendell", normalizedName: "rivendell", type: "LOCATION", introducedAt: firstUnit }),
      );
      await storage.entityRepository.add(
        buildNewEntity({
          id: "00000000-0000-4000-8000-0000000000d9",
          universeId: SECOND_OWNER_UNIVERSE.id,
          name: "Sam",
          normalizedName: "sam",
          introducedAt: foreignUnit,
        }),
      );
      const viewerContext = buildViewerContext();

      expect(
        await storage.entityRepository.findOldestNameOfSimilarEntity(viewerContext, "CHARACTER", "rivendell"),
      ).toBeNull();
      expect(
        await storage.entityRepository.findOldestNameOfSimilarEntity(viewerContext, "LOCATION", "rivendel"),
      ).toBeNull();
      expect(
        await storage.entityRepository.findOldestNameOfSimilarEntity(viewerContext, "CHARACTER", "sam"),
      ).toBeNull();
    });

    it("finds an entity of the universe of the context, and none of another universe or that does not exist", async () => {
      const { storage, firstUnit } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );
      const [otherUniverseUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a8", universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id }),
      );
      const ownEntity = buildNewEntity({ introducedAt: firstUnit });
      const foreignEntity = buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d9",
        universeId: SECOND_OWNER_UNIVERSE.id,
        introducedAt: foreignUnit as SpoilerBoundary,
      });
      const otherUniverseEntity = buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d8",
        universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
        introducedAt: otherUniverseUnit as SpoilerBoundary,
      });
      for (const newEntity of [ownEntity, foreignEntity, otherUniverseEntity]) {
        await storage.entityRepository.add(newEntity);
      }
      const viewerContext = buildViewerContext();

      expect(await storage.entityRepository.findInUniverse(viewerContext, ownEntity.id)).toEqual(
        asListedEntity(ownEntity),
      );
      expect(await storage.entityRepository.findInUniverse(viewerContext, foreignEntity.id)).toBeNull();
      expect(await storage.entityRepository.findInUniverse(viewerContext, otherUniverseEntity.id)).toBeNull();
      expect(
        await storage.entityRepository.findInUniverse(viewerContext, "00000000-0000-4000-8000-0000000000ff"),
      ).toBeNull();
      expect(
        await storage.entityRepository.findInUniverse(buildViewerContext(SECOND_OWNER_UNIVERSE), foreignEntity.id),
      ).toEqual(asListedEntity(foreignEntity));
    });

    it("describes an entity with its introduction point and its first fragment at its own point", async () => {
      const { storage, firstUnit, thirdUnit } = await setUp();
      const newEntity = buildNewEntity({
        introducedAt: firstUnit,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f1",
          content: "Carries the ring.\nAnd a sword.",
          status: "SPECULATION",
          revealedAt: thirdUnit,
        },
      });
      await storage.entityRepository.add(newEntity);

      expect(await storage.entityRepository.findDetailsInUniverse(buildViewerContext(), newEntity.id)).toEqual({
        id: newEntity.id,
        type: "CHARACTER",
        name: "Frodo",
        introducedAt: { workId: firstUnit.workId, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "1" },
        firstFragment: {
          content: "Carries the ring.\nAnd a sword.",
          status: "SPECULATION",
          revealedAt: { workId: thirdUnit.workId, workTitle: "My Novel", workMedium: "NOVEL", unitLabel: "3" },
        },
      });
    });

    it("describes an entity without a fragment with no first fragment", async () => {
      const { storage, secondUnit } = await setUp();
      const newEntity = buildNewEntity({ introducedAt: secondUnit });
      await storage.entityRepository.add(newEntity);

      const entityDetails = await storage.entityRepository.findDetailsInUniverse(buildViewerContext(), newEntity.id);

      expect(entityDetails?.firstFragment).toBeNull();
      expect(entityDetails?.introducedAt.unitLabel).toBe("2");
    });

    it("gives no details of an entity of another account's universe, of another universe of the same account or that does not exist", async () => {
      const { storage } = await setUp();
      const [foreignUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a9", universeId: SECOND_OWNER_UNIVERSE.id }),
      );
      const [otherUniverseUnit] = await storeWorkWithBoundaries(
        storage,
        buildNewWork({ id: "00000000-0000-4000-8000-0000000000a8", universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id }),
      );
      const foreignEntity = buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d9",
        universeId: SECOND_OWNER_UNIVERSE.id,
        introducedAt: foreignUnit as SpoilerBoundary,
        firstFragment: {
          id: "00000000-0000-4000-8000-0000000000f9",
          content: "Secret of the other account.",
          status: "CONFIRMED",
          revealedAt: foreignUnit as SpoilerBoundary,
        },
      });
      const otherUniverseEntity = buildNewEntity({
        id: "00000000-0000-4000-8000-0000000000d8",
        universeId: SECOND_UNIVERSE_OF_FIRST_OWNER.id,
        introducedAt: otherUniverseUnit as SpoilerBoundary,
      });
      await storage.entityRepository.add(foreignEntity);
      await storage.entityRepository.add(otherUniverseEntity);
      const viewerContext = buildViewerContext();

      expect(await storage.entityRepository.findDetailsInUniverse(viewerContext, foreignEntity.id)).toBeNull();
      expect(await storage.entityRepository.findDetailsInUniverse(viewerContext, otherUniverseEntity.id)).toBeNull();
      expect(
        await storage.entityRepository.findDetailsInUniverse(viewerContext, "00000000-0000-4000-8000-0000000000ff"),
      ).toBeNull();
    });
  });
}
