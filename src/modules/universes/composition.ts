import type { ActingUser } from "@/shared/domain/acting-user";
import { createUniverse, type CreateUniverseCommand } from "./application/create-universe";
import { isUniverseNameInUse } from "./application/is-universe-name-in-use";
import { loadWorkspaceUniverses } from "./application/load-workspace-universes";
import type { UniverseDto } from "./application/universe-dto";
import type { RememberedUniverseRepository } from "./domain/remembered-universe-repository";
import type { Universe } from "./domain/universe";
import { createInMemoryUniverseRepository } from "./infrastructure/in-memory-universe-repository";

/** The use cases of the module, already bound to their storage. */
export type UniversesModule = {
  readonly createUniverse: (command: CreateUniverseCommand) => Promise<UniverseDto>;
  readonly listUniverses: () => Promise<UniverseDto[]>;
  readonly isUniverseNameInUse: (name: string) => Promise<boolean>;
};

/** TEMPORARY: the one account of the in-memory prototype, until real accounts own universes. */
const PROTOTYPE_ACTOR: ActingUser = {
  userId: "prototype-user",
  displayName: "Prototype",
  email: "prototype@example.com",
};

function toUniverse(startingUniverse: UniverseDto): Universe {
  return {
    ...startingUniverse,
    ownerId: PROTOTYPE_ACTOR.userId,
    createdAt: new Date(startingUniverse.createdAt),
    updatedAt: new Date(startingUniverse.updatedAt),
  };
}

/** The prototype remembers nothing: the workspace there always starts from the first universe. */
const forgetfulRememberedUniverseRepository: RememberedUniverseRepository = {
  async findRememberedUniverseId() {
    return null;
  },
  async saveRememberedUniverse() {},
};

/**
 * TEMPORARY (bridge, removed with the client data layer): wires the use cases to a
 * repository kept in memory and to a fixed prototype actor, so created universes live only
 * while the page is open. Each call builds a new repository; two compositions never share
 * data.
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
    createUniverse: (command) => createUniverse(createUniverseDependencies, PROTOTYPE_ACTOR, command),
    listUniverses: async () => {
      const { universes } = await loadWorkspaceUniverses(
        {
          universeRepository,
          rememberedUniverseRepository: forgetfulRememberedUniverseRepository,
        },
        PROTOTYPE_ACTOR,
      );
      return [...universes];
    },
    isUniverseNameInUse: (name) =>
      isUniverseNameInUse({ universeRepository }, PROTOTYPE_ACTOR, name),
  };
}
