import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import type { KnowledgeStatus } from "./knowledge-status";
import type { NarrativePoint } from "./narrative-point";

/**
 * A directed relationship about to be stored: from the source entity to the target entity, with one
 * type of the catalog of its universe, a status and the point where it is revealed. Nothing else
 * (no description, FR-7).
 */
export type NewRelationship = {
  readonly id: string;
  readonly universeId: string;
  readonly relationshipTypeId: string;
  readonly sourceEntityId: string;
  readonly targetEntityId: string;
  readonly status: KnowledgeStatus;
  readonly revealedAt: SpoilerBoundary;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** One end of a relationship: an entity with the name it has now. */
export type RelatedEntity = {
  readonly id: string;
  readonly name: string;
};

/** A stored relationship that is not deleted, as it is read from one of its two entities. */
export type EntityRelationship = {
  readonly id: string;
  readonly relationshipTypeId: string;
  readonly status: KnowledgeStatus;
  readonly source: RelatedEntity;
  readonly target: RelatedEntity;
  readonly revealedAt: NarrativePoint;
  readonly createdAt: Date;
};
