import { createUniversesModule } from "@/modules/universes";
import type { ActingUser } from "@/shared/domain/acting-user";
import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import { createEntity, type CreateEntityCommand, type EntityCreation } from "./application/create-entity";
import {
  createRelationship,
  type CreatedRelationshipDto,
  type CreateRelationshipCommand,
} from "./application/create-relationship";
import { createWork, type CreateWorkCommand } from "./application/create-work";
import type { EntityDetailsDto } from "./application/entity-details-dto";
import type { EntitySummaryDto } from "./application/entity-dto";
import { getEntityDetails } from "./application/get-entity-details";
import { listEntities } from "./application/list-entities";
import { listWorks } from "./application/list-works";
import type { OwnUniverseLookup } from "./application/own-universe-lookup";
import type { RelationshipTypeCatalog, RelationshipTypeDto } from "./application/relationship-type-catalog";
import { resolveViewerContext } from "./application/resolve-viewer-context";
import type { WorkDto } from "./application/work-dto";
import { createPrismaEntityRepository } from "./infrastructure/prisma-entity-repository";
import { createPrismaRelationshipRepository } from "./infrastructure/prisma-relationship-repository";
import { createPrismaWorkRepository } from "./infrastructure/prisma-work-repository";

/** What the workspace reads of one own universe, including the choices of the relationship form. */
export type UniverseKnowledge = {
  readonly works: readonly WorkDto[];
  readonly entities: readonly EntitySummaryDto[];
  readonly relationshipTypes: readonly RelationshipTypeDto[];
};

/** The operations of the module, already bound to PostgreSQL. Each one takes the acting user first. */
export type KnowledgeModule = {
  readonly createWork: (actor: ActingUser, command: CreateWorkCommand) => Promise<WorkDto>;
  readonly createEntity: (actor: ActingUser, command: CreateEntityCommand) => Promise<EntityCreation>;
  readonly createRelationship: (
    actor: ActingUser,
    command: CreateRelationshipCommand,
  ) => Promise<CreatedRelationshipDto>;
  /** Checks the ownership of the universe once, then reads with the `ViewerContext` it builds. */
  readonly loadUniverseKnowledge: (actor: ActingUser, universeId: string) => Promise<UniverseKnowledge>;
  /** Checks the ownership of the universe, then reads the details of one of its entities (FR-10). */
  readonly loadEntityDetails: (actor: ActingUser, universeId: string, entityId: string) => Promise<EntityDetailsDto>;
};

/**
 * Wires the use cases to the Prisma repositories and the two ports to the public interface of the
 * universes module. The catalog port is bound to the acting user of each operation, because the
 * universes module reads the catalog for an acting user (decision D-T4-1). Creating the module
 * touches nothing: the environment and the Prisma client are built the first time an operation
 * needs them.
 */
export function createKnowledgeModule(): KnowledgeModule {
  const universesModule = createUniversesModule();
  const ownUniverseLookup: OwnUniverseLookup = {
    findOwnUniverse: (actor, universeId) => universesModule.findOwnUniverse(actor, universeId),
  };
  const relationshipTypeCatalogOf = (actor: ActingUser): RelationshipTypeCatalog => ({
    listRelationshipTypes: async (viewerContext) => {
      const relationshipTypes = await universesModule.listRelationshipTypes(actor, viewerContext.universeId);
      return relationshipTypes.map(({ id, key, label, inverseLabel, isSymmetric }) => ({
        id,
        key,
        label,
        inverseLabel,
        isSymmetric,
      }));
    },
  });
  const workRepository = createPrismaWorkRepository(getPrismaClient);
  const entityRepository = createPrismaEntityRepository(getPrismaClient);
  const relationshipRepository = createPrismaRelationshipRepository(getPrismaClient);
  const createWorkDependencies = {
    ownUniverseLookup,
    workRepository,
    generateWorkId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };
  const createEntityDependencies = {
    ownUniverseLookup,
    workRepository,
    entityRepository,
    generateEntityId: () => crypto.randomUUID(),
    generateFragmentId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };
  const createRelationshipDependencies = {
    ownUniverseLookup,
    workRepository,
    entityRepository,
    relationshipRepository,
    generateRelationshipId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };

  return {
    createWork: (actor, command) => createWork(createWorkDependencies, actor, command),
    createEntity: (actor, command) => createEntity(createEntityDependencies, actor, command),
    createRelationship: (actor, command) =>
      createRelationship(
        { ...createRelationshipDependencies, relationshipTypeCatalog: relationshipTypeCatalogOf(actor) },
        actor,
        command,
      ),
    loadUniverseKnowledge: async (actor, universeId) => {
      const viewerContext = await resolveViewerContext({ ownUniverseLookup }, actor, universeId);
      return {
        works: await listWorks({ workRepository }, viewerContext),
        entities: await listEntities({ entityRepository }, viewerContext),
        relationshipTypes: await relationshipTypeCatalogOf(actor).listRelationshipTypes(viewerContext),
      };
    },
    loadEntityDetails: async (actor, universeId, entityId) => {
      const viewerContext = await resolveViewerContext({ ownUniverseLookup }, actor, universeId);
      return getEntityDetails(
        { entityRepository, relationshipRepository, relationshipTypeCatalog: relationshipTypeCatalogOf(actor) },
        viewerContext,
        entityId,
      );
    },
  };
}
