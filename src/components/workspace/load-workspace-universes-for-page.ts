import { createUniversesModule, type UniverseDto } from "@/modules/universes";
import { AuthenticationError } from "@/shared/domain/error-kinds";
import { getActingUser } from "@/shared/presentation/get-acting-user";

export type WorkspacePageLoad =
  | {
      readonly status: "loaded";
      readonly universes: readonly UniverseDto[];
      /** The remembered universe, else the oldest, else none (FR-26, FR-27). */
      readonly initialUniverseId: string | null;
      /** The account the page is rendered for; the tab compares it later to notice an account change (FR-18). */
      readonly accountKey: string;
    }
  | { readonly status: "signed-out" };

/**
 * Reads what the workspace needs on the server: the own universes and the one to select first. No
 * session is the `signed-out` outcome (the page sends the person to sign in); a session that cannot
 * be checked, or a failure to read, is rethrown so the error page shows it and the person is not
 * treated as signed out (FR-33).
 */
export async function loadWorkspaceUniversesForPage(): Promise<WorkspacePageLoad> {
  try {
    const actor = await getActingUser();
    const { universes, initialUniverseId } = await createUniversesModule().loadWorkspaceUniverses(actor);
    return { status: "loaded", universes, initialUniverseId, accountKey: actor.userId };
  } catch (error) {
    if (error instanceof AuthenticationError) return { status: "signed-out" };
    throw error;
  }
}
