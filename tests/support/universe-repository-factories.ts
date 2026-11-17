import type { Universe } from "@/modules/universes/domain/universe";
import type { ActingUser } from "@/shared/domain/acting-user";
import type {
  UniverseStorage,
  UniverseStorageFactory,
} from "./contracts/universe-repository-contract";
import { createFakeRememberedUniverseRepository } from "./fakes/fake-remembered-universe-repository";
import { createFakeUniverseRepository } from "./fakes/fake-universe-repository";

export const FIRST_OWNER_ID = "10000000-0000-4000-8000-000000000001";
export const SECOND_OWNER_ID = "10000000-0000-4000-8000-000000000002";

export function buildActingUser(userId: string = FIRST_OWNER_ID): ActingUser {
  return { userId, displayName: "Test person", email: `${userId}@example.com` };
}

async function createFakeUniverseStorage(
  startingUniverses: readonly Universe[] = [],
): Promise<UniverseStorage> {
  return {
    universeRepository: createFakeUniverseRepository(startingUniverses),
    rememberedUniverseRepository: createFakeRememberedUniverseRepository(),
  };
}

/** The interchangeable storages every use case scenario runs against (NFR-1). */
export const universeStorageFactories: ReadonlyArray<readonly [string, UniverseStorageFactory]> = [
  ["fake storage", createFakeUniverseStorage],
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
