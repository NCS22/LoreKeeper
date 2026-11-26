import { getPrismaClient } from "@/shared/infrastructure/prisma-client";
import type { ActingUser } from "@/shared/domain/acting-user";
import { createUniverse, type CreateUniverseCommand } from "./application/create-universe";
import { findOwnUniverse } from "./application/find-own-universe";
import { isUniverseNameInUse } from "./application/is-universe-name-in-use";
import { listRelationshipTypes } from "./application/list-relationship-types";
import {
  loadWorkspaceUniverses,
  type WorkspaceUniverses,
} from "./application/load-workspace-universes";
import { rememberUniverse, type RememberUniverseCommand } from "./application/remember-universe";
import type { RelationshipTypeDto } from "./application/relationship-type-dto";
import type { UniverseDto } from "./application/universe-dto";
import { createPrismaRelationshipTypeRepository } from "./infrastructure/prisma-relationship-type-repository";
import { createPrismaRememberedUniverseRepository } from "./infrastructure/prisma-remembered-universe-repository";
import { createPrismaUniverseRepository } from "./infrastructure/prisma-universe-repository";

/** The use cases of the module, already bound to PostgreSQL. Each one takes the acting user first. */
export type UniversesModule = {
  readonly createUniverse: (actor: ActingUser, command: CreateUniverseCommand) => Promise<UniverseDto>;
  readonly loadWorkspaceUniverses: (actor: ActingUser) => Promise<WorkspaceUniverses>;
  readonly isUniverseNameInUse: (actor: ActingUser, name: string) => Promise<boolean>;
  readonly rememberUniverse: (actor: ActingUser, command: RememberUniverseCommand) => Promise<void>;
  /** The own universe, or `null` for a foreign, deleted or nonexistent one (the ownership check of other modules). */
  readonly findOwnUniverse: (actor: ActingUser, universeId: string) => Promise<UniverseDto | null>;
  readonly listRelationshipTypes: (
    actor: ActingUser,
    universeId: string,
  ) => Promise<readonly RelationshipTypeDto[]>;
};

/**
 * Wires the six use cases to the Prisma repositories. Creating the module touches nothing: the
 * environment and the Prisma client are built the first time a use case needs them, so importing
 * this file and calling this function work without a database or a `.env`.
 */
export function createUniversesModule(): UniversesModule {
  const universeRepository = createPrismaUniverseRepository(getPrismaClient);
  const rememberedUniverseRepository = createPrismaRememberedUniverseRepository(getPrismaClient);
  const relationshipTypeRepository = createPrismaRelationshipTypeRepository(getPrismaClient);
  const createUniverseDependencies = {
    universeRepository,
    generateUniverseId: () => crypto.randomUUID(),
    getCurrentTime: () => new Date(),
  };

  return {
    createUniverse: (actor, command) => createUniverse(createUniverseDependencies, actor, command),
    loadWorkspaceUniverses: (actor) =>
      loadWorkspaceUniverses({ universeRepository, rememberedUniverseRepository }, actor),
    isUniverseNameInUse: (actor, name) => isUniverseNameInUse({ universeRepository }, actor, name),
    rememberUniverse: (actor, command) =>
      rememberUniverse({ universeRepository, rememberedUniverseRepository }, actor, command),
    findOwnUniverse: (actor, universeId) => findOwnUniverse({ universeRepository }, actor, universeId),
    listRelationshipTypes: (actor, universeId) =>
      listRelationshipTypes({ universeRepository, relationshipTypeRepository }, actor, universeId),
  };
}
