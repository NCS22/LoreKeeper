import type { Universe } from "./universe";

/**
 * The universe selected when the workspace opens: the remembered one when it is among the own
 * universes, otherwise the first of them (the oldest), otherwise none. A remembered universe
 * that is not available is not an error (FR-27).
 */
export function chooseInitialUniverseId(
  ownUniverses: readonly Pick<Universe, "id">[],
  rememberedUniverseId: string | null,
): string | null {
  const rememberedUniverseIsAvailable = ownUniverses.some(
    (universe) => universe.id === rememberedUniverseId,
  );
  if (rememberedUniverseId !== null && rememberedUniverseIsAvailable) {
    return rememberedUniverseId;
  }

  return ownUniverses[0]?.id ?? null;
}
