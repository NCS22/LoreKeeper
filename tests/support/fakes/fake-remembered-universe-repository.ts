import type { RememberedUniverseRepository } from "@/modules/universes/domain/remembered-universe-repository";

/** One remembered universe per owner, the last write winning, as the contract demands. */
export function createFakeRememberedUniverseRepository(): RememberedUniverseRepository {
  const rememberedUniverseIdsByOwnerId = new Map<string, string>();

  return {
    async findRememberedUniverseId(ownerId) {
      return rememberedUniverseIdsByOwnerId.get(ownerId) ?? null;
    },
    async saveRememberedUniverse(ownerId, universeId) {
      rememberedUniverseIdsByOwnerId.set(ownerId, universeId);
    },
  };
}
