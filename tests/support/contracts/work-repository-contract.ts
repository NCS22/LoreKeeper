import { describe, expect, it } from "vitest";
import type { OwnUniverseLookup } from "@/modules/knowledge/application/own-universe-lookup";
import type { EntityRepository } from "@/modules/knowledge/domain/entity-repository";
import type { NewNarrativeUnit, NewWork } from "@/modules/knowledge/domain/work";
import type { WorkRepository } from "@/modules/knowledge/domain/work-repository";
import type { Universe } from "@/modules/universes/domain/universe";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import type { StoredFragment } from "../fakes/fake-entity-repository";
import { buildNewWork, buildNumberedTestUnits } from "../knowledge-repository-factories";
import { SECOND_OWNER_ID } from "../universe-owners";
import { buildUniverse } from "../universe-repository-factories";

/**
 * What the knowledge module stores through, kept by one implementation, plus what a test needs to
 * look at the stored rows or to make the storage fail. The ownership lookup is the real use case of
 * the universes module over the same kind of storage.
 */
export type KnowledgeStorage = {
  readonly ownUniverseLookup: OwnUniverseLookup;
  readonly workRepository: WorkRepository;
  /** The stored units of a work, in order of their ordinal, as `{ label, ordinal }`. */
  readonly readStoredUnitsOfWork: (workId: string) => Promise<readonly NewNarrativeUnit[]>;
  readonly countStoredWorks: () => Promise<number>;
  /** Makes every following write of a narrative unit fail, until `restoreUnitWrites`. */
  readonly makeUnitWritesFail: () => Promise<void>;
  readonly restoreUnitWrites: () => Promise<void>;
  /** The label of a stored unit, or `null` when no unit has that identifier. */
  readonly readLabelOfStoredUnit: (unitId: string) => Promise<string | null>;
  readonly entityRepository: EntityRepository;
  /** The stored fragments of an entity, oldest first, deleted ones included. */
  readonly readStoredFragmentsOfEntity: (entityId: string) => Promise<readonly StoredFragment[]>;
  readonly countStoredEntities: () => Promise<number>;
  readonly countStoredFragments: () => Promise<number>;
  /** Makes every following write of a fragment fail, until `restoreFragmentWrites`. */
  readonly makeFragmentWritesFail: () => Promise<void>;
  readonly restoreFragmentWrites: () => Promise<void>;
};

/** Builds an empty storage holding the given universes (their owners are the two test accounts). */
export type KnowledgeStorageFactory = (
  startingUniverses?: readonly Universe[],
) => Promise<KnowledgeStorage>;

export const FIRST_UNIVERSE = buildUniverse({
  id: "00000000-0000-4000-8000-000000000001",
  name: "First universe",
});
export const SECOND_OWNER_UNIVERSE = buildUniverse({
  id: "00000000-0000-4000-8000-000000000003",
  ownerId: SECOND_OWNER_ID,
  name: "Universe of another account",
  mode: "AUTHOR",
});

export function buildViewerContext(universe: Universe = FIRST_UNIVERSE): ViewerContext {
  return { viewerUserId: universe.ownerId, universeId: universe.id, universeMode: universe.mode };
}

function withoutUnits({ units, ...work }: NewWork) {
  return { ...work, unitCount: units.length };
}

/**
 * The scenarios every storage of works must satisfy, the fake and PostgreSQL alike (NFR-1): the
 * work stored with all its units or nothing, the order, and the scope by universe.
 */
export function describeWorkStorageContract(
  description: string,
  createStorage: KnowledgeStorageFactory,
): void {
  describe(`work storage contract: ${description}`, () => {
    const startingUniverses = [FIRST_UNIVERSE, SECOND_OWNER_UNIVERSE];

    it("stores a work with all its units and lists it with its number of units", async () => {
      const storage = await createStorage(startingUniverses);
      const newWork = buildNewWork({ units: buildNumberedTestUnits(3) });

      await storage.workRepository.add(newWork);

      expect(await storage.workRepository.findAllInUniverse(buildViewerContext())).toEqual([
        withoutUnits(newWork),
      ]);
      expect(await storage.readStoredUnitsOfWork(newWork.id)).toEqual([
        { label: "1", ordinal: 1000 },
        { label: "2", ordinal: 2000 },
        { label: "3", ordinal: 3000 },
      ]);
    });

    it("lists the works oldest first, and works created at the same instant by identifier", async () => {
      const storage = await createStorage(startingUniverses);
      const sameInstant = new Date("2026-03-01T10:00:00.000Z");
      const newestWork = buildNewWork({
        id: "00000000-0000-4000-8000-0000000000a1",
        title: "Newest",
        createdAt: new Date("2026-04-01T10:00:00.000Z"),
        updatedAt: new Date("2026-04-01T10:00:00.000Z"),
      });
      const tiedWorkWithHigherId = buildNewWork({
        id: "00000000-0000-4000-8000-0000000000b2",
        title: "Tied, higher identifier",
        createdAt: sameInstant,
        updatedAt: sameInstant,
      });
      const tiedWorkWithLowerId = buildNewWork({
        id: "00000000-0000-4000-8000-0000000000b1",
        title: "Tied, lower identifier",
        createdAt: sameInstant,
        updatedAt: sameInstant,
      });
      for (const newWork of [newestWork, tiedWorkWithHigherId, tiedWorkWithLowerId]) {
        await storage.workRepository.add(newWork);
      }

      const listedWorks = await storage.workRepository.findAllInUniverse(buildViewerContext());

      expect(listedWorks.map((work) => work.title)).toEqual([
        "Tied, lower identifier",
        "Tied, higher identifier",
        "Newest",
      ]);
    });

    it("lists nothing for a universe without works", async () => {
      const storage = await createStorage(startingUniverses);

      expect(await storage.workRepository.findAllInUniverse(buildViewerContext())).toEqual([]);
    });

    it("lists only the works of the universe of the context, never those of another account's universe", async () => {
      const storage = await createStorage(startingUniverses);
      const ownWork = buildNewWork({ id: "00000000-0000-4000-8000-0000000000c1", title: "Own" });
      const foreignWork = buildNewWork({
        id: "00000000-0000-4000-8000-0000000000c2",
        universeId: SECOND_OWNER_UNIVERSE.id,
        title: "Foreign",
      });
      await storage.workRepository.add(ownWork);
      await storage.workRepository.add(foreignWork);

      const firstOwnerWorks = await storage.workRepository.findAllInUniverse(buildViewerContext());
      const secondOwnerWorks = await storage.workRepository.findAllInUniverse(
        buildViewerContext(SECOND_OWNER_UNIVERSE),
      );

      expect(firstOwnerWorks.map((work) => work.title)).toEqual(["Own"]);
      expect(secondOwnerWorks.map((work) => work.title)).toEqual(["Foreign"]);
    });

    it("stores a work of 5000 units in one operation", async () => {
      const storage = await createStorage(startingUniverses);
      const newWork = buildNewWork({ units: buildNumberedTestUnits(5000) });

      await storage.workRepository.add(newWork);

      const [listedWork] = await storage.workRepository.findAllInUniverse(buildViewerContext());
      expect(listedWork?.unitCount).toBe(5000);
      const storedUnits = await storage.readStoredUnitsOfWork(newWork.id);
      expect(storedUnits).toHaveLength(5000);
      expect(storedUnits.at(-1)).toEqual({ label: "5000", ordinal: 5_000_000 });
    });

    it("stores neither the work nor any of its units when the units cannot be stored", async () => {
      const storage = await createStorage(startingUniverses);
      const newWork = buildNewWork({ units: buildNumberedTestUnits(4) });
      await storage.makeUnitWritesFail();

      await expect(storage.workRepository.add(newWork)).rejects.toBeInstanceOf(InfrastructureError);

      await storage.restoreUnitWrites();
      expect(await storage.countStoredWorks()).toBe(0);
      expect(await storage.readStoredUnitsOfWork(newWork.id)).toEqual([]);
      expect(await storage.workRepository.findAllInUniverse(buildViewerContext())).toEqual([]);
    });

    it("finds the boundary of a unit number of a work of the universe of the context", async () => {
      const storage = await createStorage(startingUniverses);
      const newWork = buildNewWork({ units: buildNumberedTestUnits(3) });
      await storage.workRepository.add(newWork);

      const boundary = await storage.workRepository.findBoundaryOfUnitNumber(
        buildViewerContext(),
        newWork.id,
        2,
      );

      expect(boundary?.workId).toBe(newWork.id);
      expect(await storage.readLabelOfStoredUnit(boundary?.unitId ?? "")).toBe("2");
    });

    it.each([0, 4, 5000])(
      "finds no boundary for unit number %i, which no unit of a work of 3 units has",
      async (unitNumber) => {
        const storage = await createStorage(startingUniverses);
        const newWork = buildNewWork({ units: buildNumberedTestUnits(3) });
        await storage.workRepository.add(newWork);

        expect(
          await storage.workRepository.findBoundaryOfUnitNumber(buildViewerContext(), newWork.id, unitNumber),
        ).toBeNull();
      },
    );

    it("finds no boundary in a work of another account's universe, nor in a work that does not exist", async () => {
      const storage = await createStorage(startingUniverses);
      const foreignWork = buildNewWork({ universeId: SECOND_OWNER_UNIVERSE.id });
      await storage.workRepository.add(foreignWork);

      expect(
        await storage.workRepository.findBoundaryOfUnitNumber(buildViewerContext(), foreignWork.id, 1),
      ).toBeNull();
      expect(
        await storage.workRepository.findBoundaryOfUnitNumber(
          buildViewerContext(),
          "00000000-0000-4000-8000-0000000000ff",
          1,
        ),
      ).toBeNull();
    });

    it("stores the work with its units when it is added again after a failed attempt", async () => {
      const storage = await createStorage(startingUniverses);
      const newWork = buildNewWork({ units: buildNumberedTestUnits(2) });
      await storage.makeUnitWritesFail();
      await expect(storage.workRepository.add(newWork)).rejects.toBeInstanceOf(InfrastructureError);
      await storage.restoreUnitWrites();

      await storage.workRepository.add(newWork);

      expect(await storage.workRepository.findAllInUniverse(buildViewerContext())).toEqual([
        withoutUnits(newWork),
      ]);
      expect(await storage.readStoredUnitsOfWork(newWork.id)).toHaveLength(2);
    });
  });
}
