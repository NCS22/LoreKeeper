import { createUniverse, type CreateUniverseCommand } from "./application/create-universe";
import { isUniverseNameInUse } from "./application/is-universe-name-in-use";
import { listUniverses } from "./application/list-universes";
import type { UniverseDto } from "./application/universe-dto";
import type { Universe } from "./domain/universe";
import { createInMemoryUniverseRepository } from "./infrastructure/in-memory-universe-repository";

/** The use cases of the module, already bound to their storage. */
export type UniversesModule = {
  readonly createUniverse: (command: CreateUniverseCommand) => Promise<UniverseDto>;
  readonly listUniverses: () => Promise<UniverseDto[]>;
  readonly isUniverseNameInUse: (name: string) => Promise<boolean>;
};

function toUniverse(startingUniverse: UniverseDto): Universe {
  return {
    ...startingUniverse,
    createdAt: new Date(startingUniverse.createdAt),
    updatedAt: new Date(startingUniverse.updatedAt),
  };
}

/**
 * TEMPORARY: wires the use cases to a repository kept in memory, so created universes live
 * only while the page is open (FR-24). Each call builds a new repository; two compositions
 * never share data. It is replaced by a composition over a Prisma repository when real
 * storage arrives; the domain and the use cases do not change.
 */
export function createUniversesInMemory(
  startingUniverses: readonly UniverseDto[] = [],
): UniversesModule {
  const universeRepository = createInMemoryUniverseRepository(startingUniverses.map(toUniverse));
  const createUniverseDependencies = {
    universeRepository,
    generateUniverseId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };

  return {
    createUniverse: (command) => createUniverse(createUniverseDependencies, command),
    listUniverses: () => listUniverses({ universeRepository }),
    isUniverseNameInUse: (name) => isUniverseNameInUse({ universeRepository }, name),
  };
}
