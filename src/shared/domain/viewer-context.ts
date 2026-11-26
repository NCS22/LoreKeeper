/** The mode of the universe being read, as the read use cases need it. */
export type ViewerUniverseMode = "READER" | "AUTHOR";

/**
 * Who reads and which own universe, built by a composition only after the ownership check, and
 * required by every read use case (architecture.md, section 6). Until reading progress exists
 * (Phase 4) it carries ownership data only; the reading position and the visibility rule that uses
 * it come with that phase.
 */
export type ViewerContext = {
  readonly viewerUserId: string;
  readonly universeId: string;
  readonly universeMode: ViewerUniverseMode;
};
