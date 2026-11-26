import { PREDEFINED_RELATIONSHIP_TYPES } from "@/modules/universes/domain/predefined-relationship-types";
import type { RelationshipType } from "@/modules/universes/domain/relationship-type";
import type { RelationshipTypeRepository } from "@/modules/universes/domain/relationship-type-repository";
import type { Universe } from "@/modules/universes/domain/universe";
import { InfrastructureError } from "@/shared/domain/error-kinds";

type StoredRelationshipTypeRow = RelationshipType & { readonly ownerId: string };

/**
 * The relationship type rows of one fake storage, shared by the fake universe repository (which
 * writes the types of a new universe) and the fake relationship type repository (which reads them),
 * as both PostgreSQL repositories share one table.
 */
export type FakeRelationshipTypeTable = {
  /** Writes the eight predefined types of a new universe, or throws, writing nothing, when broken. */
  readonly storeTypesOfNewUniverse: (universe: Universe) => void;
  readonly readTypesOfOwnedUniverse: (ownerId: string, universeId: string) => RelationshipType[];
  readonly makeWritesFail: () => void;
  readonly restoreWrites: () => void;
};

function compareByKey(firstType: RelationshipType, secondType: RelationshipType): number {
  if (firstType.key === secondType.key) {
    return 0;
  }
  return firstType.key < secondType.key ? -1 : 1;
}

export function createFakeRelationshipTypeTable(): FakeRelationshipTypeTable {
  const rowsByUniverseIdAndKey = new Map<string, StoredRelationshipTypeRow>();
  let writesFail = false;

  return {
    storeTypesOfNewUniverse(universe) {
      if (writesFail) {
        throw new InfrastructureError("The universe storage failed while trying to store a universe.");
      }
      for (const predefinedType of PREDEFINED_RELATIONSHIP_TYPES) {
        const rowKey = `${universe.id}:${predefinedType.key}`;
        // Like the partial unique index of PostgreSQL: a universe never gets a second copy of a key.
        if (!rowsByUniverseIdAndKey.has(rowKey)) {
          rowsByUniverseIdAndKey.set(rowKey, {
            ...predefinedType,
            id: crypto.randomUUID(),
            universeId: universe.id,
            ownerId: universe.ownerId,
            isPredefined: true,
          });
        }
      }
    },
    readTypesOfOwnedUniverse(ownerId, universeId) {
      return [...rowsByUniverseIdAndKey.values()]
        .filter((row) => row.ownerId === ownerId && row.universeId === universeId)
        .map((row) => ({
          id: row.id,
          universeId: row.universeId,
          key: row.key,
          label: row.label,
          inverseLabel: row.inverseLabel,
          isSymmetric: row.isSymmetric,
          isPredefined: row.isPredefined,
        }))
        .sort(compareByKey);
    },
    makeWritesFail() {
      writesFail = true;
    },
    restoreWrites() {
      writesFail = false;
    },
  };
}

/** Reads the shared table, scoped by owner, as the contract demands (NFR-1). */
export function createFakeRelationshipTypeRepository(
  relationshipTypeTable: FakeRelationshipTypeTable,
): RelationshipTypeRepository {
  return {
    async findAllInOwnedUniverse(ownerId, universeId) {
      return relationshipTypeTable.readTypesOfOwnedUniverse(ownerId, universeId);
    },
  };
}
