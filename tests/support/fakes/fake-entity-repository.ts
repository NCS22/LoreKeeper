import type { Entity, NewEntity, NewKnowledgeEntry } from "@/modules/knowledge/domain/entity";
import type { NarrativePoint } from "@/modules/knowledge/domain/narrative-point";
import type { EntityRepository } from "@/modules/knowledge/domain/entity-repository";
import { parseEntityType } from "@/modules/knowledge/domain/entity-type";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";

/** A stored fragment as a test looks at it: no identifier, no dates. */
export type StoredFragment = Omit<NewKnowledgeEntry, "id">;

/** The test repository of entities, with what a test needs to look at or to make the storage fail. */
export type FakeEntityRepository = EntityRepository & {
  readStoredFragmentsOfEntity(entityId: string): readonly StoredFragment[];
  countStoredEntities(): number;
  /** Whether a stored entity of that universe has the identifier, as a composite foreign key checks. */
  holdsEntityInUniverse(universeId: string, entityId: string): boolean;
  /** The name of a stored entity; it fails when no entity has that identifier. */
  readNameOfStoredEntity(entityId: string): string;
  countStoredFragments(): number;
  /** Makes every following write of a fragment fail, until `restoreFragmentWrites`. */
  makeFragmentWritesFail(): void;
  restoreFragmentWrites(): void;
};

/** What the fake entity repository reads of the fake work repository, as PostgreSQL joins the tables. */
export type StoredWorksReader = {
  /** Whether a boundary is a work of the universe with one of its units. */
  readonly holdsBoundaryInUniverse: (universeId: string, boundary: SpoilerBoundary) => boolean;
  /** The stored boundary with the title and medium of its work and the label of its unit. */
  readonly describeStoredPoint: (boundary: SpoilerBoundary) => NarrativePoint;
};

type StoredEntityRow = {
  readonly serializedEntity: string;
  readonly normalizedName: string;
  readonly serializedFragments: string;
};

type SerializedEntity = Omit<Entity, "type" | "createdAt" | "updatedAt"> & {
  readonly type: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function deserializeEntity(serializedEntity: string): Entity {
  // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by `add`.
  const row: SerializedEntity = JSON.parse(serializedEntity);
  const entityType = parseEntityType(row.type);
  if (entityType === null) {
    throw new Error("The fake repository holds an entity with an invalid type.");
  }
  return {
    id: row.id,
    universeId: row.universeId,
    type: entityType,
    name: row.name,
    introducedAt: { workId: row.introducedAt.workId, unitId: row.introducedAt.unitId },
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function compareByCreationThenId(firstEntity: Entity, secondEntity: Entity): number {
  const creationDifference = firstEntity.createdAt.getTime() - secondEntity.createdAt.getTime();
  if (creationDifference !== 0) {
    return creationDifference;
  }
  return firstEntity.id.localeCompare(secondEntity.id, "en");
}

/**
 * Entities and fragments in memory, held as serialized text so nothing the caller keeps can alter
 * what is stored. It must give the same results as the PostgreSQL repository (NFR-1): the order,
 * the scope by universe, the all-or-nothing write of an entity with its fragment and the refusal of
 * a boundary outside the universe or with a unit of another work (the composite foreign keys).
 */
export function createFakeEntityRepository(storedWorks: StoredWorksReader): FakeEntityRepository {
  const rowsByEntityId = new Map<string, StoredEntityRow>();
  let fragmentWritesFail = false;

  function readFragments(row: StoredEntityRow): StoredFragment[] {
    // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by `add`.
    const fragments: StoredFragment[] = JSON.parse(row.serializedFragments);
    return fragments;
  }

  function readEntitiesOfUniverse(universeId: string): Entity[] {
    return [...rowsByEntityId.values()]
      .map((row) => deserializeEntity(row.serializedEntity))
      .filter((entity) => entity.universeId === universeId)
      .sort(compareByCreationThenId);
  }

  function isBoundaryOfUniverse(universeId: string, boundary: SpoilerBoundary): boolean {
    return storedWorks.holdsBoundaryInUniverse(universeId, boundary);
  }

  function readEntityOfUniverse(universeId: string, entityId: string): Entity | null {
    const row = rowsByEntityId.get(entityId);
    if (row === undefined) {
      return null;
    }
    const entity = deserializeEntity(row.serializedEntity);
    return entity.universeId === universeId ? entity : null;
  }

  function refuse(): never {
    throw new InfrastructureError("The fake storage failed while trying to store an entity.");
  }

  return {
    async add(newEntity: NewEntity) {
      const { firstFragment, normalizedName, ...entity } = newEntity;
      if (!isBoundaryOfUniverse(entity.universeId, entity.introducedAt)) {
        refuse();
      }
      if (firstFragment !== null) {
        // The fragment is checked first: when it fails, the entity is not stored either.
        if (fragmentWritesFail || !isBoundaryOfUniverse(entity.universeId, firstFragment.revealedAt)) {
          refuse();
        }
      }
      const fragments: StoredFragment[] =
        firstFragment === null
          ? []
          : [{ content: firstFragment.content, status: firstFragment.status, revealedAt: firstFragment.revealedAt }];
      rowsByEntityId.set(entity.id, {
        serializedEntity: JSON.stringify({
          ...entity,
          createdAt: entity.createdAt.toISOString(),
          updatedAt: entity.updatedAt.toISOString(),
        }),
        normalizedName,
        serializedFragments: JSON.stringify(fragments),
      });
    },
    async findAllInUniverse(viewerContext) {
      return readEntitiesOfUniverse(viewerContext.universeId);
    },
    async findOldestNameOfSimilarEntity(viewerContext, entityType, normalizedName) {
      const similarEntity = readEntitiesOfUniverse(viewerContext.universeId).find(
        (entity) =>
          entity.type === entityType && rowsByEntityId.get(entity.id)?.normalizedName === normalizedName,
      );
      return similarEntity?.name ?? null;
    },
    async findInUniverse(viewerContext, entityId) {
      return readEntityOfUniverse(viewerContext.universeId, entityId);
    },
    async findDetailsInUniverse(viewerContext, entityId) {
      const entity = readEntityOfUniverse(viewerContext.universeId, entityId);
      const row = rowsByEntityId.get(entityId);
      if (entity === null || row === undefined) {
        return null;
      }
      // A fake entity holds at most one fragment, its first one.
      const [firstFragment] = readFragments(row);
      return {
        id: entity.id,
        type: entity.type,
        name: entity.name,
        introducedAt: storedWorks.describeStoredPoint(entity.introducedAt),
        firstFragment:
          firstFragment === undefined
            ? null
            : {
                content: firstFragment.content,
                status: firstFragment.status,
                revealedAt: storedWorks.describeStoredPoint(firstFragment.revealedAt),
              },
      };
    },
    holdsEntityInUniverse(universeId, entityId) {
      return readEntityOfUniverse(universeId, entityId) !== null;
    },
    readNameOfStoredEntity(entityId) {
      const row = rowsByEntityId.get(entityId);
      if (row === undefined) {
        throw new Error("The fake repository holds a relationship with an entity that is not stored.");
      }
      return deserializeEntity(row.serializedEntity).name;
    },
    readStoredFragmentsOfEntity(entityId) {
      const row = rowsByEntityId.get(entityId);
      return row === undefined ? [] : readFragments(row);
    },
    countStoredEntities() {
      return rowsByEntityId.size;
    },
    countStoredFragments() {
      return [...rowsByEntityId.values()].reduce((count, row) => count + readFragments(row).length, 0);
    },
    makeFragmentWritesFail() {
      fragmentWritesFail = true;
    },
    restoreFragmentWrites() {
      fragmentWritesFail = false;
    },
  };
}
