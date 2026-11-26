import type { ActingUser } from "@/shared/domain/acting-user";
import type { ViewerUniverseMode } from "@/shared/domain/viewer-context";

/** What the knowledge module needs to know about an own universe. */
export type OwnUniverse = {
  readonly id: string;
  readonly mode: ViewerUniverseMode;
};

/**
 * Port to the universes module: the own, not deleted universe of the acting user, or `null` for a
 * universe of another account, a deleted one and one that does not exist alike. A malformed
 * identifier is a `ValidationError` on `universeId`. The composition implements it with the public
 * interface of the universes module.
 */
export type OwnUniverseLookup = {
  findOwnUniverse(actor: ActingUser, universeId: string): Promise<OwnUniverse | null>;
};
