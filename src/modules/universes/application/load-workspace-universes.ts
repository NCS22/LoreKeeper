import type { ActingUser } from "@/shared/domain/acting-user";
import { chooseInitialUniverseId } from "../domain/initial-universe-selection";
import type { RememberedUniverseRepository } from "../domain/remembered-universe-repository";
import type { UniverseRepository } from "../domain/universe-repository";
import { toUniverseDto, type UniverseDto } from "./universe-dto";

export type LoadWorkspaceUniversesDependencies = {
  readonly universeRepository: UniverseRepository;
  readonly rememberedUniverseRepository: RememberedUniverseRepository;
};

export type WorkspaceUniverses = {
  readonly universes: readonly UniverseDto[];
  readonly initialUniverseId: string | null;
};

/**
 * What the workspace needs when it opens: the own universes in creation order and the one to
 * select first. A remembered universe that is not available is not an error.
 */
export async function loadWorkspaceUniverses(
  dependencies: LoadWorkspaceUniversesDependencies,
  actor: ActingUser,
): Promise<WorkspaceUniverses> {
  const ownUniverses = await dependencies.universeRepository.findAllOwnedBy(actor.userId);
  const rememberedUniverseId =
    await dependencies.rememberedUniverseRepository.findRememberedUniverseId(actor.userId);

  return {
    universes: ownUniverses.map(toUniverseDto),
    initialUniverseId: chooseInitialUniverseId(ownUniverses, rememberedUniverseId),
  };
}
