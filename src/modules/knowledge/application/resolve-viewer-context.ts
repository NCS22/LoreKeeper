import type { ActingUser } from "@/shared/domain/acting-user";
import type { ViewerContext } from "@/shared/domain/viewer-context";
import { KnowledgeItemNotFoundError } from "../domain/knowledge-errors";
import type { OwnUniverseLookup } from "./own-universe-lookup";

export type ResolveViewerContextDependencies = {
  readonly ownUniverseLookup: OwnUniverseLookup;
};

/**
 * The ownership check every use case of the module starts with. It builds the context of an own
 * universe of the acting user; a universe of another account, a deleted one and one that does not
 * exist give the same `KnowledgeItemNotFoundError`, and a malformed identifier the validation error
 * of the universes module. The context carries ownership data only until Phase 4.
 */
export async function resolveViewerContext(
  dependencies: ResolveViewerContextDependencies,
  actor: ActingUser,
  universeId: string,
): Promise<ViewerContext> {
  const ownUniverse = await dependencies.ownUniverseLookup.findOwnUniverse(actor, universeId);
  if (ownUniverse === null) {
    throw new KnowledgeItemNotFoundError();
  }

  return { viewerUserId: actor.userId, universeId: ownUniverse.id, universeMode: ownUniverse.mode };
}
