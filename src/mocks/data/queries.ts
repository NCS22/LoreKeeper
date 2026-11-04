import { ENTITY_RECORDS } from "@/mocks/data/entities";
import type { CitationRecord, EntityRecord } from "@/mocks/data/entity-records";
import { EVENTS } from "@/mocks/data/events";
import { comparePositions } from "@/mocks/data/positions";
import { RELATIONSHIPS } from "@/mocks/data/relationships";
import { SOURCES } from "@/mocks/data/sources";
import { UNIVERSES } from "@/mocks/data/universes";
import { NARRATIVE_UNITS, WORKS } from "@/mocks/data/works";
import type {
  EntityAliasDto,
  EntityDetailDto,
  EntityEventDto,
  EntityRelationshipDto,
  EntitySummaryDto,
  KnowledgeEntryDto,
} from "@/mocks/dto/entity";
import type { CitationDto } from "@/mocks/dto/source";
import type { RelationshipDto } from "@/mocks/dto/relationship";
import type { UniverseDto } from "@/mocks/dto/universe";
import type { NarrativeUnitDto, WorkDto } from "@/mocks/dto/work";

// Stand-ins for the read use cases of the real app. The prototype shows everything (AUTHOR mode).

const SAMPLE_TIMESTAMP = "2026-10-02T09:00:00.000Z";

export function getUniverses(): readonly UniverseDto[] {
  return UNIVERSES;
}

export function findUniverse(universeId: string): UniverseDto | undefined {
  return UNIVERSES.find((universe) => universe.id === universeId);
}

export function getWorksOfUniverse(universeId: string): WorkDto[] {
  return WORKS.filter((work) => work.universeId === universeId).sort(
    (first, second) => first.displayOrder - second.displayOrder,
  );
}

export function findWork(workId: string): WorkDto | undefined {
  return WORKS.find((work) => work.id === workId);
}

export function getUnitsOfWork(workId: string): NarrativeUnitDto[] {
  return NARRATIVE_UNITS.filter((unit) => unit.workId === workId);
}

function toSummary(record: EntityRecord): EntitySummaryDto {
  return {
    id: record.id,
    universeId: record.universeId,
    type: record.type,
    name: record.name,
    introducedAt: record.introducedAt,
  };
}

// A work shows the entities introduced in it plus those it adds knowledge or aliases to.
function isEntityPresentInWork(record: EntityRecord, workId: string): boolean {
  return (
    record.introducedAt.workId === workId ||
    record.knowledge.some((fragment) => fragment.at.workId === workId) ||
    (record.aliases ?? []).some((alias) => alias.at.workId === workId)
  );
}

export function getEntitiesOfUniverse(universeId: string, workId: string | null): EntitySummaryDto[] {
  return ENTITY_RECORDS.filter(
    (record) => record.universeId === universeId && (workId === null || isEntityPresentInWork(record, workId)),
  )
    .map(toSummary)
    .sort((first, second) => first.name.localeCompare(second.name));
}

export function getRelationshipsBetween(universeId: string, entityIds: ReadonlySet<string>): RelationshipDto[] {
  return RELATIONSHIPS.filter(
    (relationship) =>
      relationship.universeId === universeId &&
      entityIds.has(relationship.sourceEntityId) &&
      entityIds.has(relationship.targetEntityId),
  );
}

function toCitationDtos(citations: readonly CitationRecord[]): CitationDto[] {
  return citations.map(([sourceId, locator]) => {
    const source = SOURCES.find((candidate) => candidate.id === sourceId);
    if (source === undefined) throw new Error(`Sample data cites the unknown source ${sourceId}`);
    return { sourceId, sourceTitle: source.title, locator };
  });
}

export function findEntityDetail(entityId: string): EntityDetailDto | undefined {
  const record = ENTITY_RECORDS.find((candidate) => candidate.id === entityId);
  if (record === undefined) return undefined;

  const aliases: EntityAliasDto[] = (record.aliases ?? [])
    .map((alias, index) => ({ id: `${record.id}-alias-${index + 1}`, alias: alias.alias, revealedAt: alias.at }))
    .sort((first, second) => comparePositions(first.revealedAt, second.revealedAt));

  const knowledge: KnowledgeEntryDto[] = record.knowledge
    .map((fragment, index) => ({
      id: `${record.id}-knowledge-${index + 1}`,
      content: fragment.content,
      status: fragment.status,
      revealedAt: fragment.at,
      citations: toCitationDtos(fragment.citations),
    }))
    .sort((first, second) => comparePositions(first.revealedAt, second.revealedAt));

  const entityNames = new Map(ENTITY_RECORDS.map((candidate) => [candidate.id, candidate]));
  const relationships: EntityRelationshipDto[] = RELATIONSHIPS.filter(
    (relationship) => relationship.sourceEntityId === entityId || relationship.targetEntityId === entityId,
  )
    .map((relationship) => {
      const isOutgoing = relationship.sourceEntityId === entityId;
      const relatedRecord = entityNames.get(isOutgoing ? relationship.targetEntityId : relationship.sourceEntityId);
      if (relatedRecord === undefined) throw new Error(`Relationship ${relationship.id} points to a missing entity`);
      return {
        id: relationship.id,
        direction: isOutgoing ? ("OUTGOING" as const) : ("INCOMING" as const),
        label: isOutgoing ? relationship.type.label : relationship.type.inverseLabel,
        relatedEntity: { id: relatedRecord.id, name: relatedRecord.name, type: relatedRecord.type },
        description: relationship.description,
        status: relationship.status,
        revealedAt: relationship.revealedAt,
      };
    })
    .sort((first, second) => comparePositions(first.revealedAt, second.revealedAt));

  const events: EntityEventDto[] = EVENTS.flatMap((event) =>
    event.participants
      .filter((participant) => participant.entityId === entityId)
      .map((participant) => ({
        id: event.id,
        title: event.title,
        role: participant.role,
        chronologicalLabel: event.chronologicalLabel,
        status: event.status,
        discoveredAt: event.discoveredAt,
      })),
  );

  return {
    ...toSummary(record),
    attributes: {},
    aliases,
    knowledge,
    relationships,
    events,
    createdAt: SAMPLE_TIMESTAMP,
    updatedAt: SAMPLE_TIMESTAMP,
  };
}
