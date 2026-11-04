import type { UniverseDto } from "@/mocks/dto/universe";

export const EMBER_UNIVERSE_ID = "universe-ember-concordat";
export const TIDEWRACK_UNIVERSE_ID = "universe-tidewrack";

// Invented universes. The prototype shows everything, as an AUTHOR universe does.
export const UNIVERSES: readonly UniverseDto[] = [
  {
    id: EMBER_UNIVERSE_ID,
    name: "The Ember Concordat",
    description:
      "A continent kept at peace by an old treaty between the lamp-lit cities of the coast and the salt guilds of the inland marshes.",
    coverImageUrl: null,
    mode: "AUTHOR",
    createdAt: "2026-10-02T09:00:00.000Z",
    updatedAt: "2026-11-01T18:30:00.000Z",
  },
  {
    id: TIDEWRACK_UNIVERSE_ID,
    name: "Tidewrack",
    description: "A small archipelago whose ledgers record every wreck that washes ashore.",
    coverImageUrl: null,
    mode: "AUTHOR",
    createdAt: "2026-10-20T14:00:00.000Z",
    updatedAt: "2026-10-28T11:15:00.000Z",
  },
];
