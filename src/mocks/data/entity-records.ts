import type { EntityTypeDto } from "@/mocks/dto/entity";
import type { InformationStatusDto, NarrativePositionDto } from "@/mocks/dto/shared";

// Compact authoring format for sample entities. `queries.ts` expands it into the DTOs.

export const ENTITY_IDS = {
  maraVenn: "entity-mara-venn",
  corinVale: "entity-corin-vale",
  isoldeMarsh: "entity-isolde-marsh",
  taroQuill: "entity-taro-quill",
  odricThane: "entity-odric-thane",
  wren: "entity-wren",
  portHalden: "entity-port-halden",
  brinewalkMarshes: "entity-brinewalk-marshes",
  lighthouseOfCinders: "entity-lighthouse-of-cinders",
  saltgate: "entity-saltgate",
  lampGuild: "entity-lamp-guild",
  saltAssembly: "entity-salt-assembly",
  cinderPact: "entity-cinder-pact",
  quietWardens: "entity-quiet-wardens",
  concordatScroll: "entity-concordat-scroll",
  emberglassLantern: "entity-emberglass-lantern",
  emberSense: "entity-ember-sense",
  brinecalling: "entity-brinecalling",
  ashkin: "entity-ashkin",
  theLongDusk: "entity-the-long-dusk",
  inesCalloway: "entity-ines-calloway",
  gullPoint: "entity-gull-point",
  wreckRegistry: "entity-wreck-registry",
  brassSextant: "entity-brass-sextant",
} as const;

export type CitationRecord = readonly [sourceId: string, locator: string | null];

export type KnowledgeRecord = {
  content: string;
  status: InformationStatusDto;
  at: NarrativePositionDto;
  citations: readonly CitationRecord[];
};

export type AliasRecord = {
  alias: string;
  at: NarrativePositionDto;
};

export type EntityRecord = {
  id: string;
  universeId: string;
  type: EntityTypeDto;
  name: string;
  introducedAt: NarrativePositionDto;
  aliases?: readonly AliasRecord[];
  knowledge: readonly KnowledgeRecord[];
};

export function confirmed(
  at: NarrativePositionDto,
  content: string,
  ...citations: CitationRecord[]
): KnowledgeRecord {
  return { content, status: "CONFIRMED", at, citations };
}

export function userNote(at: NarrativePositionDto, content: string, ...citations: CitationRecord[]): KnowledgeRecord {
  return { content, status: "USER_NOTE", at, citations };
}

export function speculation(
  at: NarrativePositionDto,
  content: string,
  ...citations: CitationRecord[]
): KnowledgeRecord {
  return { content, status: "SPECULATION", at, citations };
}
