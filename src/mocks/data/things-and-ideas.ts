import { confirmed, ENTITY_IDS, speculation, userNote, type EntityRecord } from "@/mocks/data/entity-records";
import { inNovel } from "@/mocks/data/positions";
import { SOURCE_IDS } from "@/mocks/data/sources";
import { EMBER_UNIVERSE_ID } from "@/mocks/data/universes";

export const THING_AND_IDEA_RECORDS: readonly EntityRecord[] = [
  {
    id: ENTITY_IDS.concordatScroll,
    universeId: EMBER_UNIVERSE_ID,
    type: "OBJECT",
    name: "The Concordat Scroll",
    introducedAt: inNovel("Prologue"),
    aliases: [{ alias: "The Ember Treaty", at: inNovel("Vol. 1, Ch. 5") }],
    knowledge: [
      confirmed(
        inNovel("Prologue"),
        "The treaty between coast and marsh, written in ash ink that only shows in lamplight.",
        [SOURCE_IDS.novelPrologue, "p. 4"],
      ),
      confirmed(
        inNovel("Vol. 3, Ch. 1"),
        "Stolen from its vault. The copy the Guild shows in public is a forgery.",
        [SOURCE_IDS.novelVolume3Chapter1, "p. 21"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.emberglassLantern,
    universeId: EMBER_UNIVERSE_ID,
    type: "OBJECT",
    name: "The Emberglass Lantern",
    introducedAt: inNovel("Vol. 1, Ch. 1"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 1"), "Mara's lantern, with amber glass and a flame that never needs oil."),
      confirmed(
        inNovel("Vol. 2, Ch. 3"),
        "It stores the memory of fire, which is what lets Mara read old flames.",
        [SOURCE_IDS.novelVolume2Chapter3, "p. 90"],
      ),
      speculation(inNovel("Vol. 3, Ch. 3"), "It may have belonged to Corin before it was Mara's."),
    ],
  },
  {
    id: ENTITY_IDS.emberSense,
    universeId: EMBER_UNIVERSE_ID,
    type: "ABILITY",
    name: "Ember Sense",
    introducedAt: inNovel("Vol. 1, Ch. 3"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 3"), "The ability to see where fire has burned, even long afterwards."),
      confirmed(inNovel("Vol. 2, Ch. 5"), "Grows stronger near the Lighthouse of Cinders."),
      confirmed(
        inNovel("Vol. 3, Ch. 2"),
        "The author has said it is inherited through the Ashkin line, not learned.",
        [SOURCE_IDS.authorInterview, "min. 14"],
      ),
    ],
  },
  {
    id: ENTITY_IDS.brinecalling,
    universeId: EMBER_UNIVERSE_ID,
    type: "ABILITY",
    name: "Brinecalling",
    introducedAt: inNovel("Vol. 1, Ch. 4"),
    knowledge: [
      confirmed(inNovel("Vol. 1, Ch. 4"), "Salt Assembly art: binding brine with the voice and a pinch of salt."),
      confirmed(
        inNovel("Vol. 3, Ch. 3"),
        "Isolde uses it to freeze a flooding street and hold back the Guild.",
      ),
    ],
  },
  {
    id: ENTITY_IDS.ashkin,
    universeId: EMBER_UNIVERSE_ID,
    type: "SPECIES",
    name: "The Ashkin",
    introducedAt: inNovel("Vol. 2, Ch. 3"),
    knowledge: [
      confirmed(inNovel("Vol. 2, Ch. 3"), "People marked by the ember. Warmth lingers around them and old fires answer them."),
      confirmed(
        inNovel("Vol. 3, Ch. 2"),
        "Hunted by the Cinder Pact, which believes their warmth is what powers the lamps.",
        [SOURCE_IDS.novelVolume3Chapter2, "p. 143"],
      ),
      userNote(
        inNovel("Vol. 3, Ch. 2"),
        "The scars appear on the forearm. Check Wren and Mara.",
        [SOURCE_IDS.readingNotes, null],
      ),
    ],
  },
  {
    id: ENTITY_IDS.theLongDusk,
    universeId: EMBER_UNIVERSE_ID,
    type: "CONCEPT",
    name: "The Long Dusk",
    introducedAt: inNovel("Interlude"),
    knowledge: [
      confirmed(inNovel("Interlude"), "A prophesied age in which every lamp fails. It is named in the preamble of the Concordat."),
      speculation(
        inNovel("Vol. 2, Ch. 4"),
        "Some Guild elders believe the Night the Lamps Failed was its first warning.",
        [SOURCE_IDS.authorAfterword, null],
      ),
    ],
  },
];
