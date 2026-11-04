import { ENTITY_IDS } from "@/mocks/data/entity-records";
import { inNovel, inSaltLedger } from "@/mocks/data/positions";
import { EMBER_UNIVERSE_ID, TIDEWRACK_UNIVERSE_ID } from "@/mocks/data/universes";
import type { RelationshipDto, RelationshipTypeDto } from "@/mocks/dto/relationship";
import type { InformationStatusDto, NarrativePositionDto } from "@/mocks/dto/shared";

// Predefined catalog proposed in data-model.md, seeded for every universe.
const PREDEFINED_TYPES = [
  { key: "MEMBER_OF", label: "member of", inverseLabel: "has member", isSymmetric: false },
  { key: "LEADER_OF", label: "leader of", inverseLabel: "led by", isSymmetric: false },
  { key: "ALLY_OF", label: "ally of", inverseLabel: "ally of", isSymmetric: true },
  { key: "ENEMY_OF", label: "enemy of", inverseLabel: "enemy of", isSymmetric: true },
  { key: "PARENT_OF", label: "parent of", inverseLabel: "child of", isSymmetric: false },
  { key: "SIBLING_OF", label: "sibling of", inverseLabel: "sibling of", isSymmetric: true },
  { key: "LOCATED_IN", label: "located in", inverseLabel: "contains", isSymmetric: false },
  { key: "POSSESSES", label: "possesses", inverseLabel: "possessed by", isSymmetric: false },
] as const;

type RelationshipTypeKey = (typeof PREDEFINED_TYPES)[number]["key"];

export const RELATIONSHIP_TYPES: readonly (RelationshipTypeDto & { universeId: string })[] = [
  EMBER_UNIVERSE_ID,
  TIDEWRACK_UNIVERSE_ID,
].flatMap((universeId) =>
  PREDEFINED_TYPES.map((type) => ({ ...type, id: `${universeId}-relationship-type-${type.key}`, universeId })),
);

type RelationshipRecord = {
  source: string;
  type: RelationshipTypeKey;
  target: string;
  status: InformationStatusDto;
  at: NarrativePositionDto;
  description?: string;
};

function relationshipsOf(universeId: string, idPrefix: string, records: readonly RelationshipRecord[]): RelationshipDto[] {
  return records.map((record, index) => {
    const type = RELATIONSHIP_TYPES.find(
      (candidate) => candidate.universeId === universeId && candidate.key === record.type,
    );
    if (type === undefined) throw new Error(`Unknown relationship type ${record.type}`);
    return {
      id: `${idPrefix}-${index + 1}`,
      universeId,
      type: { id: type.id, key: type.key, label: type.label, inverseLabel: type.inverseLabel, isSymmetric: type.isSymmetric },
      sourceEntityId: record.source,
      targetEntityId: record.target,
      description: record.description ?? null,
      status: record.status,
      revealedAt: record.at,
    };
  });
}

const E = ENTITY_IDS;

export const RELATIONSHIPS: readonly RelationshipDto[] = [
  ...relationshipsOf(EMBER_UNIVERSE_ID, "relationship-ember", [
    { source: E.maraVenn, type: "MEMBER_OF", target: E.lampGuild, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 1") },
    { source: E.corinVale, type: "LEADER_OF", target: E.lampGuild, status: "CONFIRMED", at: inNovel("Prologue") },
    { source: E.corinVale, type: "LEADER_OF", target: E.quietWardens, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 4") },
    { source: E.isoldeMarsh, type: "MEMBER_OF", target: E.saltAssembly, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 4") },
    { source: E.odricThane, type: "MEMBER_OF", target: E.cinderPact, status: "SPECULATION", at: inNovel("Vol. 2, Ch. 5") },
    { source: E.odricThane, type: "LEADER_OF", target: E.cinderPact, status: "CONFIRMED", at: inNovel("Vol. 3, Ch. 1") },
    { source: E.maraVenn, type: "ALLY_OF", target: E.isoldeMarsh, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 5") },
    { source: E.maraVenn, type: "ALLY_OF", target: E.taroQuill, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 2") },
    { source: E.maraVenn, type: "ALLY_OF", target: E.wren, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 1") },
    {
      source: E.isoldeMarsh,
      type: "ENEMY_OF",
      target: E.maraVenn,
      status: "CONFIRMED",
      at: inNovel("Vol. 3, Ch. 3"),
      description: "The alliance ends over the lantern.",
    },
    { source: E.odricThane, type: "ENEMY_OF", target: E.corinVale, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 3") },
    { source: E.corinVale, type: "PARENT_OF", target: E.maraVenn, status: "CONFIRMED", at: inNovel("Vol. 3, Ch. 2") },
    { source: E.maraVenn, type: "SIBLING_OF", target: E.wren, status: "SPECULATION", at: inNovel("Vol. 3, Ch. 4") },
    { source: E.taroQuill, type: "MEMBER_OF", target: E.cinderPact, status: "SPECULATION", at: inNovel("Vol. 2, Ch. 6") },
    { source: E.lighthouseOfCinders, type: "LOCATED_IN", target: E.portHalden, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 5") },
    { source: E.lampGuild, type: "LOCATED_IN", target: E.portHalden, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 1") },
    { source: E.saltgate, type: "LOCATED_IN", target: E.brinewalkMarshes, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 2") },
    { source: E.saltAssembly, type: "LOCATED_IN", target: E.saltgate, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 2") },
    { source: E.maraVenn, type: "POSSESSES", target: E.emberglassLantern, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 1") },
    { source: E.corinVale, type: "POSSESSES", target: E.concordatScroll, status: "CONFIRMED", at: inNovel("Prologue") },
    {
      source: E.odricThane,
      type: "POSSESSES",
      target: E.concordatScroll,
      status: "CONFIRMED",
      at: inNovel("Vol. 3, Ch. 1"),
      description: "Stolen from the vault.",
    },
    { source: E.wren, type: "MEMBER_OF", target: E.ashkin, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 3") },
    { source: E.maraVenn, type: "MEMBER_OF", target: E.ashkin, status: "USER_NOTE", at: inNovel("Vol. 3, Ch. 2") },
    { source: E.wren, type: "POSSESSES", target: E.emberSense, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 1") },
    { source: E.maraVenn, type: "POSSESSES", target: E.emberSense, status: "CONFIRMED", at: inNovel("Vol. 2, Ch. 5") },
    { source: E.isoldeMarsh, type: "POSSESSES", target: E.brinecalling, status: "CONFIRMED", at: inNovel("Vol. 1, Ch. 5") },
    { source: E.cinderPact, type: "ENEMY_OF", target: E.quietWardens, status: "CONFIRMED", at: inNovel("Vol. 3, Ch. 1") },
    { source: E.quietWardens, type: "ENEMY_OF", target: E.theLongDusk, status: "CONFIRMED", at: inNovel("Vol. 3, Ch. 3") },
  ]),
  ...relationshipsOf(TIDEWRACK_UNIVERSE_ID, "relationship-tidewrack", [
    { source: E.inesCalloway, type: "MEMBER_OF", target: E.wreckRegistry, status: "CONFIRMED", at: inSaltLedger("Ch. 1") },
    { source: E.wreckRegistry, type: "LOCATED_IN", target: E.gullPoint, status: "CONFIRMED", at: inSaltLedger("Ch. 1") },
    { source: E.inesCalloway, type: "POSSESSES", target: E.brassSextant, status: "CONFIRMED", at: inSaltLedger("Ch. 2") },
  ]),
];
