import { confirmed, ENTITY_IDS, speculation, userNote, type EntityRecord } from "@/mocks/data/entity-records";
import { inAnime, inNovel } from "@/mocks/data/positions";
import { SOURCE_IDS } from "@/mocks/data/sources";
import { EMBER_UNIVERSE_ID } from "@/mocks/data/universes";

export const PLACE_AND_GROUP_RECORDS: readonly EntityRecord[] = [
  {
    id: ENTITY_IDS.portHalden,
    universeId: EMBER_UNIVERSE_ID,
    type: "LOCATION",
    name: "Port Halden",
    introducedAt: inNovel("Prologue"),
    aliases: [{ alias: "The Lamp City", at: inNovel("Prologue") }],
    knowledge: [
      confirmed(
        inNovel("Prologue"),
        "Harbor city whose streets are lit by lamps that the Lamp Guild tends every night.",
        [SOURCE_IDS.novelPrologue, "p. 1"],
      ),
      confirmed(inNovel("Vol. 1, Ch. 3"), "Its lamps went dark for a single night, two years before the story begins."),
      confirmed(inAnime("Ep. 1"), "The anime opens with the harbor's two hundred lamps being lit one after another."),
    ],
  },
  {
    id: ENTITY_IDS.brinewalkMarshes,
    universeId: EMBER_UNIVERSE_ID,
    type: "LOCATION",
    name: "The Brinewalk Marshes",
    introducedAt: inNovel("Vol. 1, Ch. 4"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 4"), "Inland salt marshes worked by the guilds of the Salt Assembly."),
      confirmed(
        inNovel("Vol. 2, Ch. 4"),
        "The paths shift with the tide, so only guild-trained guides can cross them safely.",
      ),
    ],
  },
  {
    id: ENTITY_IDS.lighthouseOfCinders,
    universeId: EMBER_UNIVERSE_ID,
    type: "LOCATION",
    name: "The Lighthouse of Cinders",
    introducedAt: inNovel("Vol. 1, Ch. 5"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 5"), "Ancient tower on the headland where the Concordat Scroll is kept."),
      confirmed(
        inNovel("Vol. 3, Ch. 1"),
        "The vault beneath it was opened without breaking a single seal.",
        [SOURCE_IDS.novelVolume3Chapter1, "p. 19"],
      ),
      userNote(
        inNovel("Vol. 3, Ch. 1"),
        "Compare this vault with the one described in the Prologue.",
        [SOURCE_IDS.readingNotes, null],
      ),
    ],
  },
  {
    id: ENTITY_IDS.saltgate,
    universeId: EMBER_UNIVERSE_ID,
    type: "LOCATION",
    name: "Saltgate",
    introducedAt: inNovel("Vol. 2, Ch. 2"),
    knowledge: [
      confirmed(inNovel("Vol. 2, Ch. 2"), "Border town where the marsh road meets the coast road."),
      confirmed(inAnime("Ep. 7"), "The anime draws its market on stilts above the water."),
    ],
  },
  {
    id: ENTITY_IDS.lampGuild,
    universeId: EMBER_UNIVERSE_ID,
    type: "ORGANIZATION",
    name: "The Lamp Guild",
    introducedAt: inNovel("Vol. 1, Ch. 1"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 1"), "Union of lamplighters that tends and defends the lamps of Port Halden."),
      confirmed(inNovel("Vol. 2, Ch. 4"), "Quietly split in two when the Quiet Wardens formed inside it."),
      confirmed(inAnime("Ep. 2"), "The guild hall is shown with a vaulted ceiling hung with lanterns."),
    ],
  },
  {
    id: ENTITY_IDS.saltAssembly,
    universeId: EMBER_UNIVERSE_ID,
    type: "ORGANIZATION",
    name: "The Salt Assembly",
    introducedAt: inNovel("Vol. 1, Ch. 4"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 4"), "Council of the salt guilds of the marshes and a signatory of the Concordat."),
      confirmed(inNovel("Vol. 2, Ch. 2"), "Meets in Saltgate during the Parley."),
    ],
  },
  {
    id: ENTITY_IDS.cinderPact,
    universeId: EMBER_UNIVERSE_ID,
    type: "FACTION",
    name: "The Cinder Pact",
    introducedAt: inNovel("Interlude"),
    knowledge: [
      confirmed(
        inNovel("Interlude"),
        "Secret faction that wants the Concordat ended so the lamps burn only for its members.",
      ),
      confirmed(
        inNovel("Vol. 3, Ch. 1"),
        "Led by Odric Thane, who speaks for it as the Voice of the Pact.",
        [SOURCE_IDS.novelVolume3Chapter1, "p. 12"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.quietWardens,
    universeId: EMBER_UNIVERSE_ID,
    type: "FACTION",
    name: "The Quiet Wardens",
    introducedAt: inNovel("Vol. 2, Ch. 4"),
    knowledge: [
      confirmed(inNovel("Vol. 2, Ch. 4"), "Guild members loyal to Corin Vale who guard the treaty in secret."),
      speculation(inNovel("Vol. 2, Ch. 6"), "May already have members inside the Chancellor's office."),
    ],
  },
];
