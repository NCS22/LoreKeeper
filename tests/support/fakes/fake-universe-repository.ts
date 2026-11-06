import type { Universe } from "@/modules/universes/domain/universe";
import { parseUniverseMode } from "@/modules/universes/domain/universe-mode";
import type { UniverseRepository } from "@/modules/universes/domain/universe-repository";

type StoredUniverseRow = {
  readonly sequenceNumber: number;
  readonly serializedUniverse: string;
};

type SerializedUniverse = {
  readonly id: string;
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
    name: row.name,
    description: row.description,
    mode,
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

/**
 * A second repository built differently from the production in-memory one: rows live in
 * a map keyed by identifier, hold serialized text instead of objects and are ordered by
 * a sequence number. Both must satisfy the same contract (NFR-1).
 */
export function createFakeUniverseRepository(
  startingUniverses: readonly Universe[] = [],
): UniverseRepository {
  const rowsByUniverseId = new Map<string, StoredUniverseRow>();
  let nextSequenceNumber = 0;

  function storeRow(universe: Universe): void {
    rowsByUniverseId.set(universe.id, {
      sequenceNumber: nextSequenceNumber,
      serializedUniverse: serializeUniverse(universe),
    });
    nextSequenceNumber += 1;
  }

  startingUniverses.forEach(storeRow);

  return {
    async findAll() {
      return [...rowsByUniverseId.values()]
        .sort((firstRow, secondRow) => firstRow.sequenceNumber - secondRow.sequenceNumber)
        .map((row) => deserializeUniverse(row.serializedUniverse));
    },
    async add(universe) {
      storeRow(universe);
    },
  };
}
