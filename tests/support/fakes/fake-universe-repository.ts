import type { Universe } from "@/modules/universes/domain/universe";
import { parseUniverseMode } from "@/modules/universes/domain/universe-mode";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";

type StoredUniverseRow = {
  readonly serializedUniverse: string;
};

type SerializedUniverse = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | null;
  readonly mode: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function serializeUniverse(universe: Universe): string {
  return JSON.stringify({
    ...universe,
    createdAt: universe.createdAt.toISOString(),
    updatedAt: universe.updatedAt.toISOString(),
  });
}

function deserializeUniverse(serializedUniverse: string): Universe {
  // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by serializeUniverse.
  const row: SerializedUniverse = JSON.parse(serializedUniverse);
  const mode = parseUniverseMode(row.mode);
  if (mode === null) {
    throw new Error("The fake repository holds a universe with an invalid mode.");
  }
  return {
    id: row.id,
    ownerId: row.ownerId,
    name: row.name,
    description: row.description,
    mode,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function compareByCreationThenId(firstUniverse: Universe, secondUniverse: Universe): number {
  const creationDifference = firstUniverse.createdAt.getTime() - secondUniverse.createdAt.getTime();
  if (creationDifference !== 0) {
    return creationDifference;
  }
  return firstUniverse.id.localeCompare(secondUniverse.id, "en");
}

/**
 * The test repository: rows live in a map keyed by identifier and hold serialized text, so
 * nothing the caller holds can alter what is stored. It orders and scopes by owner as the
 * contract demands, and must give the same results as the PostgreSQL repository (NFR-1).
 */
export function createFakeUniverseRepository(
  startingUniverses: readonly Universe[] = [],
): UniverseRepository {
  const rowsByUniverseId = new Map<string, StoredUniverseRow>();

  function storeRow(universe: Universe): void {
    rowsByUniverseId.set(universe.id, { serializedUniverse: serializeUniverse(universe) });
  }

  function readAllUniverses(): Universe[] {
    return [...rowsByUniverseId.values()].map((row) => deserializeUniverse(row.serializedUniverse));
  }

  startingUniverses.forEach(storeRow);

  return {
    async findAllOwnedBy(ownerId) {
      return readAllUniverses()
        .filter((universe) => universe.ownerId === ownerId)
        .sort(compareByCreationThenId);
    },
    async findOwnedById(ownerId, universeId) {
      return (
        readAllUniverses().find(
          (universe) => universe.ownerId === ownerId && universe.id === universeId,
        ) ?? null
      );
    },
    async add(universe) {
      storeRow(universe);
    },
  };
}
