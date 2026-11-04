import { confirmed, ENTITY_IDS, userNote, type EntityRecord } from "@/data/entity-records";
import { inSaltLedger } from "@/data/positions";
import { SOURCE_IDS } from "@/data/sources";
import { TIDEWRACK_UNIVERSE_ID } from "@/data/universes";

export const TIDEWRACK_RECORDS: readonly EntityRecord[] = [
  {
    id: ENTITY_IDS.inesCalloway,
    universeId: TIDEWRACK_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Ines Calloway",
    introducedAt: inSaltLedger("Ch. 1"),
    knowledge: [
      confirmed(inSaltLedger("Ch. 1"), "Youngest keeper of the wreck ledgers on Gull Point."),
      confirmed(
        inSaltLedger("Ch. 2"),
        "Keeps a second, private ledger of the ships that never reached the registry.",
        [SOURCE_IDS.saltLedgerChapter2, "p. 9"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.gullPoint,
    universeId: TIDEWRACK_UNIVERSE_ID,
    type: "LOCATION",
    name: "Gull Point",
    introducedAt: inSaltLedger("Ch. 1"),
    knowledge: [confirmed(inSaltLedger("Ch. 1"), "Windswept headland at the north end of the archipelago.")],
  },
  {
    id: ENTITY_IDS.wreckRegistry,
    universeId: TIDEWRACK_UNIVERSE_ID,
    type: "ORGANIZATION",
    name: "The Wreck Registry",
    introducedAt: inSaltLedger("Ch. 1"),
    knowledge: [
      confirmed(inSaltLedger("Ch. 1"), "Office that logs every wreck that reaches the islands."),
      userNote(inSaltLedger("Ch. 3"), "Its seal looks the same as the one on the first page of the private ledger."),
    ],
  },
  {
    id: ENTITY_IDS.brassSextant,
    universeId: TIDEWRACK_UNIVERSE_ID,
    type: "OBJECT",
    name: "The Brass Sextant",
    introducedAt: inSaltLedger("Ch. 2"),
    knowledge: [confirmed(inSaltLedger("Ch. 2"), "Salvaged from the first wreck Ines recorded; its scale is engraved in a dead language.")],
  },
];
