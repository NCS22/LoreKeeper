import type { UniverseRepository } from "../domain/universe-repository";
import { toUniverseDto, type UniverseDto } from "./universe-dto";

export type ListUniversesDependencies = {
  readonly universeRepository: UniverseRepository;
};

/** Every universe in creation order, so a new universe appears after the existing ones. */
export async function listUniverses(
  dependencies: ListUniversesDependencies,
): Promise<UniverseDto[]> {
  const universes = await dependencies.universeRepository.findAll();
  return universes.map(toUniverseDto);
}
