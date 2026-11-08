import { AuthenticationError } from "@/shared/domain/error-kinds";
import type { ActingUser } from "@/shared/domain/acting-user";
import type { SessionReader } from "@/shared/application/session-reader";

export type RequireActingUserDependencies = {
  readonly sessionReader: SessionReader;
};

/**
 * The one acting-user check every feature uses. Returns the account of the session, or throws
 * `AuthenticationError` when there is no valid session, so the operation that asked for the actor
 * does not run. A failure of the reader is not caught here: it reaches the caller as the
 * `InfrastructureError` the reader throws, never as an authentication error.
 */
export async function requireActingUser(
  dependencies: RequireActingUserDependencies,
): Promise<ActingUser> {
  const activeSession = await dependencies.sessionReader.readActiveSession();

  if (activeSession === null) {
    throw new AuthenticationError("There is no valid session.");
  }

  return {
    userId: activeSession.userId,
    displayName: activeSession.displayName,
    email: activeSession.email,
  };
}
