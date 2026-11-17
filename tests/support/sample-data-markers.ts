// Unique strings taken from the prototype sample data (`src/mocks/`) before it was deleted
// (specs/004-stored-universes/plan.md, section 5, "Sample data and `src/mocks`"). They are
// identifiers and long phrases a person cannot type by accident, never a plain name: a universe the
// user names "The Ember Concordat" is not a leftover. Used by the structural test
// `tests/lint/sample-data-absent.test.ts` and, from T10, by the browser test that checks no served
// page, answer or static file contains sample data.

export const SAMPLE_DATA_MARKERS = {
  universeIdentifier: "universe-ember-concordat",
  universeDescriptionSentence:
    "A continent kept at peace by an old treaty between the lamp-lit cities of the coast and the salt guilds of the inland marshes.",
  secondUniverseIdentifier: "universe-tidewrack",
  workTitle: "Ashes of the Concordat: The Animation",
  workIdentifier: "work-ashes-of-the-concordat",
  eventIdentifier: "event-signing-of-the-concordat",
  sourceTitle: "Author afterword, Volume 2",
  firstEntityIdentifier: "entity-mara-venn",
  firstRelationshipIdentifier: "relationship-ember-1",
  firstReadingPositionIdentifier: "work-ashes-of-the-concordat-unit-1",
} as const;

export const SAMPLE_DATA_MARKER_TEXTS: readonly string[] = Object.values(SAMPLE_DATA_MARKERS);
