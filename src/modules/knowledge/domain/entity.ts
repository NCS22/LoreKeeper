import type { SpoilerBoundary } from "@/shared/domain/spoiler-boundary";
import type { EntityType } from "./entity-type";
import type { KnowledgeStatus } from "./knowledge-status";
import type { NarrativePoint } from "./narrative-point";

/** The first fragment of a new entity, before it is stored, with the point where it is revealed. */
export type NewKnowledgeEntry = {
  readonly id: string;
  readonly content: string;
  readonly status: KnowledgeStatus;
  readonly revealedAt: SpoilerBoundary;
};

/**
 * An entity about to be stored, with its optional first fragment, in one all-or-nothing write. Its
 * attributes are always empty (OD-7 untouched), so they are not part of it.
 */
export type NewEntity = {
  readonly id: string;
  readonly universeId: string;
  readonly type: EntityType;
  readonly name: string;
  /** The comparable name (FR-6, D11). */
  readonly normalizedName: string;
  readonly introducedAt: SpoilerBoundary;
  readonly createdAt: Date;
  readonly updatedAt: Date;
  readonly firstFragment: NewKnowledgeEntry | null;
};

/** A stored entity that is not deleted, with its introduction point. */
export type Entity = {
  readonly id: string;
  readonly universeId: string;
  readonly type: EntityType;
  readonly name: string;
  readonly introducedAt: SpoilerBoundary;
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** A stored fragment as the details panel shows it, with its point described. */
export type KnowledgeEntryDetails = {
  readonly content: string;
  readonly status: KnowledgeStatus;
  readonly revealedAt: NarrativePoint;
};

/**
 * A stored entity that is not deleted as the details panel shows it: its introduction point
 * described and its oldest fragment that is not deleted, or `null` when it has none (FR-10, D15).
 */
export type EntityDetails = {
  readonly id: string;
  readonly type: EntityType;
  readonly name: string;
  readonly introducedAt: NarrativePoint;
  readonly firstFragment: KnowledgeEntryDetails | null;
};
