import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import type { Universe } from "@/modules/universes/domain/universe";
import type { NewNarrativeUnit, NewWork } from "@/modules/knowledge/domain/work";
import type {
  KnowledgeStorage,
  KnowledgeStorageFactory,
} from "./contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "./database/postgres-knowledge-storage";
import { createFakeWorkRepository } from "./fakes/fake-work-repository";
import { createFakeUniverseStorage } from "./universe-repository-factories";

/**
 * A fake storage: the works live in memory and the ownership lookup is the real use case of the
 * universes module over a fake universe storage holding the given universes.
 */
export async function createFakeKnowledgeStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<KnowledgeStorage> {
  const { universeRepository } = await createFakeUniverseStorage(startingUniverses);
  const workRepository = createFakeWorkRepository();
  return {
    ownUniverseLookup: {
      findOwnUniverse: (actor, universeId) => findOwnUniverse({ universeRepository }, actor, universeId),
    },
    workRepository,
    readStoredUnitsOfWork: async (workId) => workRepository.readStoredUnitsOfWork(workId),
    countStoredWorks: async () => workRepository.countStoredWorks(),
    makeUnitWritesFail: async () => workRepository.makeUnitWritesFail(),
    restoreUnitWrites: async () => workRepository.restoreUnitWrites(),
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
