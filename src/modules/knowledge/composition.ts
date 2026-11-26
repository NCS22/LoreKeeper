import { createUniversesModule } from "@/modules/universes";
import type { ActingUser } from "@/shared/domain/acting-user";
import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import { createWork, type CreateWorkCommand } from "./application/create-work";
import { listWorks } from "./application/list-works";
import type { OwnUniverseLookup } from "./application/own-universe-lookup";
import { resolveViewerContext } from "./application/resolve-viewer-context";
import type { WorkDto } from "./application/work-dto";
import { createPrismaWorkRepository } from "./infrastructure/prisma-work-repository";

/** What the workspace reads of one own universe. Entities and relationship types come later (T3, T4). */
export type UniverseKnowledge = {
  readonly works: readonly WorkDto[];
};

/** The operations of the module, already bound to PostgreSQL. Each one takes the acting user first. */
export type KnowledgeModule = {
  readonly createWork: (actor: ActingUser, command: CreateWorkCommand) => Promise<WorkDto>;
  /** Checks the ownership of the universe once, then reads with the `ViewerContext` it builds. */
  readonly loadUniverseKnowledge: (actor: ActingUser, universeId: string) => Promise<UniverseKnowledge>;
};

/**
 * Wires the use cases to the Prisma repositories and the ownership port to the public interface of
 * the universes module. Creating the module touches nothing: the environment and the Prisma client
 * are built the first time an operation needs them.
 */
export function createKnowledgeModule(): KnowledgeModule {
  const universesModule = createUniversesModule();
  const ownUniverseLookup: OwnUniverseLookup = {
    findOwnUniverse: (actor, universeId) => universesModule.findOwnUniverse(actor, universeId),
  };
  const workRepository = createPrismaWorkRepository(getPrismaClient);
  const createWorkDependencies = {
    ownUniverseLookup,
    workRepository,
    generateWorkId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };

  return {
    createWork: (actor, command) => createWork(createWorkDependencies, actor, command),
    loadUniverseKnowledge: async (actor, universeId) => {
      const viewerContext = await resolveViewerContext({ ownUniverseLookup }, actor, universeId);
      return { works: await listWorks({ workRepository }, viewerContext) };
    },
  };
}
