import { parseKnowledgeStatus } from "@/modules/knowledge/domain/knowledge-status";
import type { NarrativePoint } from "@/modules/knowledge/domain/narrative-point";
import type { EntityRelationship, NewRelationship } from "@/modules/knowledge/domain/relationship";
import type { RelationshipRepository } from "@/modules/knowledge/domain/relationship-repository";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";

/** The test repository of relationships, with what a test needs to look at the stored rows. */
export type FakeRelationshipRepository = RelationshipRepository & {
  countStoredRelationships(): number;
};

/**
 * What the fake relationship repository reads of the other fake storages, as the foreign keys and
 * joins of PostgreSQL read the other tables.
 */
export type RelationshipReferencesReader = {
  readonly holdsEntityInUniverse: (universeId: string, entityId: string) => boolean;
  readonly holdsBoundaryInUniverse: (universeId: string, boundary: SpoilerBoundary) => boolean;
  readonly holdsRelationshipTypeInUniverse: (universeId: string, relationshipTypeId: string) => Promise<boolean>;
  readonly readNameOfStoredEntity: (entityId: string) => string;
  readonly describeStoredPoint: (boundary: SpoilerBoundary) => NarrativePoint;
};

type SerializedRelationship = Omit<NewRelationship, "status" | "createdAt" | "updatedAt"> & {
  readonly status: string;
  readonly createdAt: string;
  readonly updatedAt: string;
};

function deserializeRelationship(serializedRelationship: string): NewRelationship {
  // JSON.parse is typed as returning `any`; the annotation narrows it to the shape written by `add`.
  const row: SerializedRelationship = JSON.parse(serializedRelationship);
  const status = parseKnowledgeStatus(row.status);
  if (status === null) {
    throw new Error("The fake repository holds a relationship with an invalid status.");
  }
  return {
    ...row,
    status,
    revealedAt: { workId: row.revealedAt.workId, unitId: row.revealedAt.unitId },
    createdAt: new Date(row.createdAt),
    updatedAt: new Date(row.updatedAt),
  };
}

function compareByCreationThenId(firstRelationship: NewRelationship, secondRelationship: NewRelationship): number {
  const creationDifference = firstRelationship.createdAt.getTime() - secondRelationship.createdAt.getTime();
  if (creationDifference !== 0) {
    return creationDifference;
  }
  return firstRelationship.id.localeCompare(secondRelationship.id, "en");
}

/**
 * Relationships in memory, held as serialized text so nothing the caller keeps can alter what is
 * stored. It must give the same results as the PostgreSQL repository (NFR-1): the order, the scope
 * by universe and the refusals of the database constraints (an entity related to itself, an
 * entity, a type or a boundary outside the universe, a unit of another work).
 */
export function createFakeRelationshipRepository(references: RelationshipReferencesReader): FakeRelationshipRepository {
  const serializedRelationshipsById = new Map<string, string>();

  function refuse(): never {
    throw new InfrastructureError("The fake storage failed while trying to store a relationship.");
  }

  function toEntityRelationship(relationship: NewRelationship): EntityRelationship {
    return {
      id: relationship.id,
      relationshipTypeId: relationship.relationshipTypeId,
      status: relationship.status,
      source: { id: relationship.sourceEntityId, name: references.readNameOfStoredEntity(relationship.sourceEntityId) },
      target: { id: relationship.targetEntityId, name: references.readNameOfStoredEntity(relationship.targetEntityId) },
      revealedAt: references.describeStoredPoint(relationship.revealedAt),
      createdAt: relationship.createdAt,
    };
  }

  return {
    async add(newRelationship) {
      const { universeId } = newRelationship;
      const isTypeOfUniverse = await references.holdsRelationshipTypeInUniverse(
        universeId,
        newRelationship.relationshipTypeId,
      );
      if (
        newRelationship.sourceEntityId === newRelationship.targetEntityId ||
        !references.holdsEntityInUniverse(universeId, newRelationship.sourceEntityId) ||
        !references.holdsEntityInUniverse(universeId, newRelationship.targetEntityId) ||
        !isTypeOfUniverse ||
        !references.holdsBoundaryInUniverse(universeId, newRelationship.revealedAt)
      ) {
        refuse();
      }
      serializedRelationshipsById.set(
        newRelationship.id,
        JSON.stringify({
          ...newRelationship,
          createdAt: newRelationship.createdAt.toISOString(),
          updatedAt: newRelationship.updatedAt.toISOString(),
        }),
      );
    },
    async findAllOfEntity(viewerContext, entityId) {
      return [...serializedRelationshipsById.values()]
        .map(deserializeRelationship)
        .filter(
          (relationship) =>
            relationship.universeId === viewerContext.universeId &&
            (relationship.sourceEntityId === entityId || relationship.targetEntityId === entityId),
        )
        .sort(compareByCreationThenId)
        .map(toEntityRelationship);
    },
    countStoredRelationships() {
      return serializedRelationshipsById.size;
    },
  };
}
