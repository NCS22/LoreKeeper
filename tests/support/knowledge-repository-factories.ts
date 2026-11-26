import { findOwnUniverse } from "@/modules/universes/application/find-own-universe";
import type { Universe } from "@/modules/universes/domain/universe";
import type { NewEntity } from "@/modules/knowledge/domain/entity";
import type { NewRelationship } from "@/modules/knowledge/domain/relationship";
import type { NewNarrativeUnit, NewWork } from "@/modules/knowledge/domain/work";
import type {
  KnowledgeStorage,
  KnowledgeStorageFactory,
} from "./contracts/work-repository-contract";
import { createPostgresKnowledgeStorage } from "./database/postgres-knowledge-storage";
import { createFakeEntityRepository } from "./fakes/fake-entity-repository";
import { createFakeRelationshipRepository } from "./fakes/fake-relationship-repository";
import { createFakeWorkRepository } from "./fakes/fake-work-repository";
import { createRelationshipTypeCatalogOverRepository } from "./relationship-type-catalog-over-repository";
import { createFakeUniverseStorage } from "./universe-repository-factories";

/**
 * A fake storage: the works and entities live in memory and the ownership lookup is the real use
 * case of the universes module over a fake universe storage holding the given universes.
 */
export async function createFakeKnowledgeStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<KnowledgeStorage> {
  const { universeRepository, relationshipTypeRepository } = await createFakeUniverseStorage(startingUniverses);
  const workRepository = createFakeWorkRepository();
  const entityRepository = createFakeEntityRepository({
    holdsBoundaryInUniverse: (universeId, boundary) => workRepository.holdsBoundaryInUniverse(universeId, boundary),
    describeStoredPoint: (boundary) => workRepository.describeStoredPoint(boundary),
  });
  const relationshipRepository = createFakeRelationshipRepository({
    holdsEntityInUniverse: (universeId, entityId) => entityRepository.holdsEntityInUniverse(universeId, entityId),
    holdsBoundaryInUniverse: (universeId, boundary) => workRepository.holdsBoundaryInUniverse(universeId, boundary),
    async holdsRelationshipTypeInUniverse(universeId, relationshipTypeId) {
      // Like the composite foreign key: the type must be of the universe, whoever owns it.
      const ownerId = startingUniverses.find((universe) => universe.id === universeId)?.ownerId ?? "";
      const typesOfUniverse = await relationshipTypeRepository.findAllInOwnedUniverse(ownerId, universeId);
      return typesOfUniverse.some((relationshipType) => relationshipType.id === relationshipTypeId);
    },
    readNameOfStoredEntity: (entityId) => entityRepository.readNameOfStoredEntity(entityId),
    describeStoredPoint: (boundary) => workRepository.describeStoredPoint(boundary),
  });
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
    relationshipRepository,
    countStoredRelationships: async () => relationshipRepository.countStoredRelationships(),
    relationshipTypeCatalog: createRelationshipTypeCatalogOverRepository(relationshipTypeRepository),
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

/**
 * A relationship of the first universe. Its entities, type and point must be given by the test:
 * their identifiers are assigned by the storage or by the setup of the test.
 */
export function buildNewRelationship(
  overrides: Partial<NewRelationship> &
    Pick<NewRelationship, "sourceEntityId" | "targetEntityId" | "relationshipTypeId" | "revealedAt">,
): NewRelationship {
  return {
    id: "00000000-0000-4000-8000-0000000000c0",
    universeId: "00000000-0000-4000-8000-000000000001",
    status: "USER_NOTE",
    createdAt: new Date("2026-03-03T10:00:00.000Z"),
    updatedAt: new Date("2026-03-03T10:00:00.000Z"),
    ...overrides,
  };
}
