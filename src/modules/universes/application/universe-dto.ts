import type { Universe } from "../domain/universe";
import type { UniverseMode } from "../domain/universe-mode";

/** Universe as seen outside the module. Dates are ISO 8601 strings in UTC. No cover image (FR-16). */
export type UniverseDto = {
  readonly id: string;
  readonly name: string;
  readonly description: string | null;
  readonly mode: UniverseMode;
  readonly createdAt: string;
  readonly updatedAt: string;
};

export function toUniverseDto(universe: Universe): UniverseDto {
  return {
    id: universe.id,
    name: universe.name,
    description: universe.description,
    mode: universe.mode,
    createdAt: universe.createdAt.toISOString(),
    updatedAt: universe.updatedAt.toISOString(),
  };
}
