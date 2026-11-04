import { ENTITY_IDS } from "@/mocks/data/entity-records";
import { inNovel } from "@/mocks/data/positions";
import { EMBER_UNIVERSE_ID } from "@/mocks/data/universes";
import type { EventDto } from "@/mocks/dto/event";

const E = ENTITY_IDS;

export const EVENTS: readonly EventDto[] = [
  {
    id: "event-signing-of-the-concordat",
    universeId: EMBER_UNIVERSE_ID,
    title: "Signing of the Concordat",
    description: "The coast and the marsh guilds seal the treaty in the vault under the lighthouse.",
    chronologicalLabel: "Year 1 of the Lamp Age",
    status: "CONFIRMED",
    discoveredAt: inNovel("Prologue"),
    participants: [
      { entityId: E.lampGuild, role: "PARTICIPANT" },
      { entityId: E.saltAssembly, role: "PARTICIPANT" },
      { entityId: E.concordatScroll, role: "AFFECTED" },
      { entityId: E.lighthouseOfCinders, role: "LOCATION" },
    ],
  },
  {
    id: "event-night-the-lamps-failed",
    universeId: EMBER_UNIVERSE_ID,
    title: "The Night the Lamps Failed",
    description: "Every lamp in Port Halden goes dark at once for a single night.",
    chronologicalLabel: "Year 212, midwinter",
    status: "CONFIRMED",
    discoveredAt: inNovel("Vol. 1, Ch. 3"),
    participants: [
      { entityId: E.corinVale, role: "PROTAGONIST" },
      { entityId: E.odricThane, role: "PARTICIPANT" },
      { entityId: E.maraVenn, role: "AFFECTED" },
      { entityId: E.portHalden, role: "LOCATION" },
      { entityId: E.theLongDusk, role: "MENTIONED" },
    ],
  },
  {
    id: "event-parley-at-saltgate",
    universeId: EMBER_UNIVERSE_ID,
    title: "Parley at Saltgate",
    description: "Isolde meets Mara and the Guild to negotiate safe passage through the marshes.",
    chronologicalLabel: "Year 213, autumn",
    status: "CONFIRMED",
    discoveredAt: inNovel("Vol. 2, Ch. 2"),
    participants: [
      { entityId: E.isoldeMarsh, role: "PROTAGONIST" },
      { entityId: E.maraVenn, role: "PARTICIPANT" },
      { entityId: E.taroQuill, role: "PARTICIPANT" },
      { entityId: E.saltAssembly, role: "PARTICIPANT" },
      { entityId: E.saltgate, role: "LOCATION" },
    ],
  },
  {
    id: "event-maras-awakening",
    universeId: EMBER_UNIVERSE_ID,
    title: "Mara's Awakening",
    description: "In the marshes, Mara reads a flame that burned decades ago.",
    chronologicalLabel: "Year 214, summer",
    status: "CONFIRMED",
    discoveredAt: inNovel("Vol. 2, Ch. 5"),
    participants: [
      { entityId: E.maraVenn, role: "PROTAGONIST" },
      { entityId: E.wren, role: "PARTICIPANT" },
      { entityId: E.emberglassLantern, role: "PARTICIPANT" },
      { entityId: E.emberSense, role: "MENTIONED" },
      { entityId: E.brinewalkMarshes, role: "LOCATION" },
    ],
  },
  {
    id: "event-theft-of-the-scroll",
    universeId: EMBER_UNIVERSE_ID,
    title: "Theft of the Concordat Scroll",
    description: "The vault is opened without breaking a seal and the original treaty disappears.",
    chronologicalLabel: "Year 214, spring",
    status: "CONFIRMED",
    discoveredAt: inNovel("Vol. 3, Ch. 1"),
    participants: [
      { entityId: E.odricThane, role: "PROTAGONIST" },
      { entityId: E.corinVale, role: "PARTICIPANT" },
      { entityId: E.quietWardens, role: "AFFECTED" },
      { entityId: E.lighthouseOfCinders, role: "LOCATION" },
    ],
  },
];
