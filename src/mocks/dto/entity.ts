import type { CitationDto } from "@/mocks/dto/source";
import type { EventParticipantRoleDto } from "@/mocks/dto/event";
import type { InformationStatusDto, NarrativePositionDto } from "@/mocks/dto/shared";

export type EntityTypeDto =
  | "CHARACTER"
  | "LOCATION"
  | "ORGANIZATION"
  | "FACTION"
  | "OBJECT"
  | "ABILITY"
  | "SPECIES"
  | "CONCEPT";

// What lists and the graph need: no description, because an entity's description is the
// composition of its knowledge fragments.
export type EntitySummaryDto = {
  id: string;
  universeId: string;
  type: EntityTypeDto;
  name: string;
  introducedAt: NarrativePositionDto;
};

export type EntityAliasDto = {
  id: string;
  alias: string;
  revealedAt: NarrativePositionDto;
};

export type KnowledgeEntryDto = {
  id: string;
  content: string;
  status: InformationStatusDto;
  revealedAt: NarrativePositionDto;
  citations: CitationDto[];
};

export type RelatedEntityDto = Pick<EntitySummaryDto, "id" | "name" | "type">;

// A relationship seen from one of its two entities, already worded for that side.
export type EntityRelationshipDto = {
  id: string;
  direction: "OUTGOING" | "INCOMING";
  label: string;
  relatedEntity: RelatedEntityDto;
  description: string | null;
  status: InformationStatusDto;
  revealedAt: NarrativePositionDto;
};

export type EntityEventDto = {
  id: string;
  title: string;
  role: EventParticipantRoleDto;
  chronologicalLabel: string | null;
  status: InformationStatusDto;
  discoveredAt: NarrativePositionDto;
};

// Entity detail as the API returns it. `attributes` stays empty until Phase 2 defines the
// per-type schemas.
export type EntityDetailDto = EntitySummaryDto & {
  attributes: Record<string, never>;
  aliases: EntityAliasDto[];
  knowledge: KnowledgeEntryDto[];
  relationships: EntityRelationshipDto[];
  events: EntityEventDto[];
  createdAt: string;
  updatedAt: string;
};
