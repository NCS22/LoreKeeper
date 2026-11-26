import type { Universe } from "@/modules/universes/domain/universe";
import type {
  UniverseStorage,
  UniverseStorageFactory,
} from "./contracts/universe-repository-contract";
import {
  createFakeRelationshipTypeRepository,
  createFakeRelationshipTypeTable,
} from "./fakes/fake-relationship-type-repository";
import { createFakeRememberedUniverseRepository } from "./fakes/fake-remembered-universe-repository";
import { createFakeUniverseRepository } from "./fakes/fake-universe-repository";
import { createPostgresUniverseStorage } from "./database/postgres-universe-storage";
import { FIRST_OWNER_ID } from "./universe-owners";

export { buildActingUser, FIRST_OWNER_ID, SECOND_OWNER_ID } from "./universe-owners";

/** A fake storage; the starting universes are stored with their relationship types, as `add` does. */
export async function createFakeUniverseStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<UniverseStorage> {
  const relationshipTypeTable = createFakeRelationshipTypeTable();
  return {
    universeRepository: createFakeUniverseRepository(startingUniverses, relationshipTypeTable),
    rememberedUniverseRepository: createFakeRememberedUniverseRepository(),
    relationshipTypeRepository: createFakeRelationshipTypeRepository(relationshipTypeTable),
    makeRelationshipTypeWritesFail: async () => relationshipTypeTable.makeWritesFail(),
    restoreRelationshipTypeWrites: async () => relationshipTypeTable.restoreWrites(),
  };
}

/** The interchangeable storages every use case scenario runs against (NFR-1). */
export const universeStorageFactories: ReadonlyArray<readonly [string, UniverseStorageFactory]> = [
  ["fake storage", createFakeUniverseStorage],
  ["PostgreSQL storage", createPostgresUniverseStorage],
];

export function buildUniverse(overrides: Partial<Universe> = {}): Universe {
  return {
    id: "00000000-0000-4000-8000-000000000010",
    ownerId: FIRST_OWNER_ID,
    name: "First universe",
    description: null,
    mode: "READER",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}
