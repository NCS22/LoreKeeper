import type { EntityDetails } from "../domain/entity";
import type { EntityType } from "../domain/entity-type";
import type { KnowledgeStatus } from "../domain/knowledge-status";
import type { NarrativePoint } from "../domain/narrative-point";
import type { RelationshipReading } from "../domain/relationship-reading";
import { toUnitWording, type UnitWording } from "../domain/unit-wording";

/** A point as seen outside the module: the work, its title, its unit wording and the unit label. */
export type PointDto = {
  readonly workId: string;
  readonly workTitle: string;
  readonly unitWording: UnitWording;
  readonly unitLabel: string;
};

/** The first fragment of an entity as the details panel shows it. */
export type FirstFragmentDto = {
  readonly content: string;
  readonly status: KnowledgeStatus;
  readonly point: PointDto;
};

/**
 * A relationship already read from the entity of the details: `label` is the label or the inverse
 * label chosen for that entity (FR-10). No type identifier, no ordinals.
 */
export type RelationshipReadingDto = RelationshipReading & {
  readonly id: string;
  readonly status: KnowledgeStatus;
  readonly point: PointDto;
};

/** An entity as the details panel shows it outside the module: no universe, no owner, no ordinals. */
export type EntityDetailsDto = {
  readonly id: string;
  readonly name: string;
  readonly type: EntityType;
  readonly introducedAt: PointDto;
  readonly firstFragment: FirstFragmentDto | null;
  readonly relationships: readonly RelationshipReadingDto[];
};

export function toPointDto(point: NarrativePoint): PointDto {
  return {
    workId: point.workId,
    workTitle: point.workTitle,
    unitWording: toUnitWording(point.workMedium),
    unitLabel: point.unitLabel,
  };
}

export function toEntityDetailsDto(
  entityDetails: EntityDetails,
  relationships: readonly RelationshipReadingDto[],
): EntityDetailsDto {
  const { firstFragment } = entityDetails;
  return {
    id: entityDetails.id,
    name: entityDetails.name,
    type: entityDetails.type,
    introducedAt: toPointDto(entityDetails.introducedAt),
    firstFragment:
      firstFragment === null
        ? null
        : { content: firstFragment.content, status: firstFragment.status, point: toPointDto(firstFragment.revealedAt) },
    relationships,
  };
}
