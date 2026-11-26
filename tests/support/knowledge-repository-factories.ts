import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import type { Universe } from "@/modules/universes/domain/universe";
import type { NewEntity } from "@/modules/knowledge/domain/entity";
import type { NewNarrativeUnit, NewWork } from "@/modules/knowledge/domain/work";
import type {
  KnowledgeStorage,
  KnowledgeStorageFactory,
} from "./contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "./database/postgres-knowledge-storage";
import { createFakeEntityRepository } from "./fakes/fake-entity-repository";
import { createFakeWorkRepository } from "./fakes/fake-work-repository";
import { createFakeUniverseStorage } from "./universe-repository-factories";

/**
 * A fake storage: the works and entities live in memory and the ownership lookup is the real use
 * case of the universes module over a fake universe storage holding the given universes.
 */
export async function createFakeKnowledgeStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<KnowledgeStorage> {
  const { universeRepository } = await createFakeUniverseStorage(startingUniverses);
  const workRepository = createFakeWorkRepository();
  const entityRepository = createFakeEntityRepository((universeId, boundary) =>
    workRepository.holdsBoundaryInUniverse(universeId, boundary),
  );
  return {
    ownUniverseLookup: {
      findOwnUniverse: (actor, universeId) => findOwnUniverse({ universeRepository }, actor, universeId),
    },
    workRepository,
    readStoredUnitsOfWork: async (workId) => workRepository.readStoredUnitsOfWork(workId),
    countStoredWorks: async () => workRepository.countStoredWorks(),
    makeUnitWritesFail: async () => workRepository.makeUnitWritesFail(),
    restoreUnitWrites: async () => workRepository.restoreUnitWrites(),
    readLabelOfStoredUnit: async (unitId) => workRepository.readLabelOfStoredUnit(unitId),
    entityRepository,
    readStoredFragmentsOfEntity: async (entityId) => entityRepository.readStoredFragmentsOfEntity(entityId),
    countStoredEntities: async () => entityRepository.countStoredEntities(),
    countStoredFragments: async () => entityRepository.countStoredFragments(),
    makeFragmentWritesFail: async () => entityRepository.makeFragmentWritesFail(),
    restoreFragmentWrites: async () => entityRepository.restoreFragmentWrites(),
  };
}

/** The interchangeable storages every knowledge scenario runs against (NFR-1). */
export const knowledgeStorageFactories: ReadonlyArray<readonly [string, KnowledgeStorageFactory]> = [
  ["fake storage", createFakeKnowledgeStorage],
  ["PostgreSQL storage", createPostgresKnowledgeStorage],
];

/** Units "1" to "N" with ordinals in steps of 1000, written here without the domain function. */
export function buildNumberedTestUnits(unitCount: number): readonly NewNarrativeUnit[] {
  return Array.from({ length: unitCount }, (_unused, index) => ({
    label: String(index + 1),
    ordinal: (index + 1) * 1000,
  }));
}

export function buildNewWork(overrides: Partial<NewWork> = {}): NewWork {
  return {
    id: "00000000-0000-4000-8000-0000000000a0",
    universeId: "00000000-0000-4000-8000-000000000001",
    title: "My Novel",
    medium: "NOVEL",
    createdAt: new Date("2026-03-01T10:00:00.000Z"),
    updatedAt: new Date("2026-03-01T10:00:00.000Z"),
    units: buildNumberedTestUnits(1),
    ...overrides,
  };
}

/**
 * A character of the first universe without a fragment. Its introduction point must be given by
 * the test: the unit identifiers are assigned by the storage.
 */
export function buildNewEntity(
  overrides: Partial<NewEntity> & Pick<NewEntity, "introducedAt">,
): NewEntity {
  return {
    id: "00000000-0000-4000-8000-0000000000d0",
    universeId: "00000000-0000-4000-8000-000000000001",
    type: "CHARACTER",
    name: "Frodo",
    normalizedName: "frodo",
    createdAt: new Date("2026-03-02T10:00:00.000Z"),
    updatedAt: new Date("2026-03-02T10:00:00.000Z"),
    firstFragment: null,
    ...overrides,
  };
}
