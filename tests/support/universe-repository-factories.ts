import type { Universe } from "@/modules/universes/domain/universe";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";
import { createInMemoryUniverseRepository } from "@/modules/universes/infrastructure/in-memory-universe-repository";
import { createFakeUniverseRepository } from "./fakes/fake-universe-repository";

export type UniverseRepositoryFactory = (
  startingUniverses?: readonly Universe[],
) => UniverseRepository;

/** The two interchangeable repositories every use case scenario runs against (NFR-1). */
export const universeRepositoryFactories: ReadonlyArray<
  readonly [string, UniverseRepositoryFactory]
> = [
  ["in-memory repository", createInMemoryUniverseRepository],
  ["fake repository", createFakeUniverseRepository],
];

export function buildUniverse(overrides: Partial<Universe> = {}): Universe {
  return {
    id: "universe-1",
    name: "First universe",
    description: null,
    mode: "READER",
    createdAt: new Date("2026-01-01T10:00:00.000Z"),
    updatedAt: new Date("2026-01-01T10:00:00.000Z"),
    ...overrides,
  };
}
