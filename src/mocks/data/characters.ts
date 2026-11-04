import { confirmed, ENTITY_IDS, speculation, userNote, type EntityRecord } from "@/mocks/data/entity-records";
import { inAnime, inNovel } from "@/mocks/data/positions";
import { SOURCE_IDS } from "@/mocks/data/sources";
import { EMBER_UNIVERSE_ID } from "@/mocks/data/universes";

export const CHARACTER_RECORDS: readonly EntityRecord[] = [
  {
    id: ENTITY_IDS.maraVenn,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Mara Venn",
    introducedAt: inNovel("Vol. 1, Ch. 1"),
    aliases: [{ alias: "The Lantern", at: inNovel("Vol. 2, Ch. 3") }],
    knowledge: [
      confirmed(
        inNovel("Vol. 1, Ch. 1"),
        "Sixteen-year-old apprentice lamplighter of Port Halden. She lights the harbor lamps at dusk and carries an amber lantern that never needs oil.",
        [SOURCE_IDS.novelVolume1Chapter1, "p. 12"],
      ),
      confirmed(
        inNovel("Vol. 1, Ch. 3"),
        "Raised in the Guild dormitory after her family was lost on the night the harbor lamps failed.",
        [SOURCE_IDS.novelVolume1Chapter3, "p. 61"],
      ),
      confirmed(
        inNovel("Vol. 2, Ch. 3"),
        "Can see where a flame has burned before, long after it went out. She hides this from the Guild.",
        [SOURCE_IDS.novelVolume2Chapter3, "p. 88"],
      ),
      userNote(
        inNovel("Vol. 2, Ch. 5"),
        "She hesitates every time someone mentions the Lighthouse of Cinders. Worth watching.",
        [SOURCE_IDS.readingNotes, null],
      ),
      confirmed(
        inNovel("Vol. 3, Ch. 2"),
        "Daughter of Corin Vale. He left her with the Guild so the Cinder Pact would never look for her there.",
        [SOURCE_IDS.novelVolume3Chapter2, "p. 140"],
      ),
      confirmed(
        inAnime("Ep. 5"),
        "In the anime she lights the lantern in front of the whole harbor, a scene the novel does not have.",
        [SOURCE_IDS.animeEpisode5, "14:32"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.corinVale,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Corin Vale",
    introducedAt: inNovel("Prologue"),
    aliases: [{ alias: "Tomas Reed", at: inNovel("Interlude") }],
    knowledge: [
      confirmed(
        inNovel("Prologue"),
        "Warden-General of the Lamp Guild and the last person seen carrying the Concordat Scroll.",
        [SOURCE_IDS.novelPrologue, "p. 3"],
      ),
      confirmed(
        inNovel("Vol. 1, Ch. 3"),
        "Blamed for the Night the Lamps Failed. He has not been seen in Port Halden since.",
        [SOURCE_IDS.novelVolume1Chapter3, "p. 58"],
      ),
      confirmed(inNovel("Interlude"), "Spent years in the salt marshes under the name Tomas Reed, mending boats."),
      confirmed(
        inNovel("Vol. 3, Ch. 2"),
        "Gave up his rank to protect his daughter and organized the Quiet Wardens in secret.",
        [SOURCE_IDS.novelVolume3Chapter2, "p. 137"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.isoldeMarsh,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Isolde Marsh",
    introducedAt: inNovel("Vol. 1, Ch. 4"),
    aliases: [{ alias: "Brine-Daughter", at: inNovel("Vol. 1, Ch. 5") }],
    knowledge: [
      confirmed(
        inNovel("Vol. 1, Ch. 4"),
        "Envoy of the Salt Assembly, sent to renew the treaty at Port Halden. Dry-humored and stubborn.",
        [SOURCE_IDS.novelVolume1Chapter4, "p. 77"],
      ),
      confirmed(inNovel("Vol. 1, Ch. 5"), "Can bind brine with her voice and a pinch of salt."),
      confirmed(
        inNovel("Vol. 2, Ch. 2"),
        "Led the Parley at Saltgate and kept her word to Mara even when it cost her standing.",
      ),
      confirmed(
        inNovel("Vol. 3, Ch. 3"),
        "Convinced that Mara broke the treaty by hiding the source of the lantern's light, she now stands against her.",
      ),
    ],
  },
  {
    id: ENTITY_IDS.taroQuill,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Taro Quill",
    introducedAt: inNovel("Vol. 1, Ch. 2"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 2"), "Scribe of the Guild archive and Mara's closest friend."),
      userNote(
        inNovel("Vol. 2, Ch. 5"),
        "He never says where he goes on the first night of each month.",
        [SOURCE_IDS.readingNotes, null],
      ),
      speculation(
        inNovel("Vol. 2, Ch. 6"),
        "He may be copying letters addressed to the Cinder Pact before delivering them.",
      ),
    ],
  },
  {
    id: ENTITY_IDS.odricThane,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Odric Thane",
    introducedAt: inNovel("Vol. 1, Ch. 3"),
    aliases: [{ alias: "Voice of the Pact", at: inNovel("Vol. 3, Ch. 1") }],
    knowledge: [
      confirmed(
        inNovel("Vol. 1, Ch. 3"),
        "Chancellor of Port Halden and the public face of the city's order.",
        [SOURCE_IDS.novelVolume1Chapter3, "p. 55"],
      ),
      speculation(inNovel("Vol. 2, Ch. 5"), "Sudden changes in Guild funding seem to trace back to his office."),
      confirmed(
        inNovel("Vol. 3, Ch. 1"),
        "Leads the Cinder Pact and uses the title Voice of the Pact in its meetings.",
        [SOURCE_IDS.novelVolume3Chapter1, "p. 12"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.wren,
    universeId: EMBER_UNIVERSE_ID,
    type: "CHARACTER",
    name: "Wren",
    introducedAt: inNovel("Vol. 2, Ch. 1"),
    knowledge: [
      confirmed(inNovel("Vol. 2, Ch. 1"), "A street child of Saltgate who sleeps beside the harbor lamps."),
      confirmed(
        inNovel("Vol. 2, Ch. 3"),
        "Ashkin: lamps burn brighter wherever she stands.",
        [SOURCE_IDS.novelVolume2Chapter3, "p. 91"],
      ),
      speculation(inNovel("Vol. 3, Ch. 4"), "Might be Mara's half-sibling; both carry the same ember scar."),
    ],
  },
];
