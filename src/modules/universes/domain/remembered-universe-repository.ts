/**
 * Storage port for the universe an account selected last. One per account, kept with the
 * account and not with the browser; the last write wins.
 */
export type RememberedUniverseRepository = {
  /** The identifier stored for the account, or `null` when it has none. */
  findRememberedUniverseId(ownerId: string): Promise<string | null>;
  saveRememberedUniverse(ownerId: string, universeId: string): Promise<void>;
};
