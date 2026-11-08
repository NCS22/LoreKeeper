import { APIError, BASE_ERROR_CODES } from "better-auth";
import { unstable_rethrow } from "next/navigation";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { SessionReader } from "@/shared/application/session-reader";
import type { BetterAuthInstance } from "./better-auth-instance";

const UNAUTHORIZED_STATUS_CODE = 401;

export type BetterAuthSessionReaderDependencies = {
  /** Gives the library instance. Called on first use, so building it never happens at import. */
  readonly getBetterAuthInstance: () => BetterAuthInstance;
  /** The headers of the request being served: the only input of the reader, and the only place the session cookie comes from. */
  readonly getRequestHeaders: () => Promise<Headers>;
};

/**
 * Reads the session of the request being served with the Better Auth server API. The session is
 * looked up in the database on every call (the cookie cache is off), so a session ended by
 * sign-out or removed from the database is rejected at once (FR-16, FR-26). Using a valid session
 * after the renewal interval also extends it, which is done by the library (FR-23).
 *
 * Two things are not failures of the check. The framework's own control-flow signals (dynamic
 * rendering, redirect, not found) are rethrown untouched so Next.js can handle them. And the
 * library's 401 "failed to get session", which it throws when a concurrent sign-out removes the
 * session while it is being renewed, means there is no active session: `null` (FR-26).
 *
 * Anything else that goes wrong while checking is an `InfrastructureError` with the original
 * failure as its cause. It is never `null`: a session that cannot be checked is not a signed-out
 * request (FR-22).
 */
export function createBetterAuthSessionReader(
  dependencies: BetterAuthSessionReaderDependencies,
): SessionReader {
  const { getBetterAuthInstance, getRequestHeaders } = dependencies;

  return {
    async readActiveSession() {
      try {
        const requestHeaders = await getRequestHeaders();
        const sessionWithUser = await getBetterAuthInstance().api.getSession({
          headers: requestHeaders,
        });
        if (sessionWithUser === null) {
          return null;
        }
        return {
          userId: sessionWithUser.user.id,
          displayName: sessionWithUser.user.name,
          email: sessionWithUser.user.email,
        };
      } catch (failure) {
        unstable_rethrow(failure);
        if (isSessionRemovedWhileRenewing(failure)) {
          return null;
        }
        if (failure instanceof InfrastructureError) {
          throw failure;
        }
        throw new InfrastructureError("The session of the request could not be checked.", {
          cause: failure,
        });
      }
    },
  };
}

/**
 * True only for the library's 401 with the code `FAILED_TO_GET_SESSION`. The same code also comes
 * with a 500 when the database fails, and that one is a real failure to check the session.
 * The session reader and the sign-out both treat this case as "the session has already ended".
 */
export function isSessionRemovedWhileRenewing(failure: unknown): boolean {
  return (
    failure instanceof APIError &&
    failure.statusCode === UNAUTHORIZED_STATUS_CODE &&
    failure.body?.code === BASE_ERROR_CODES.FAILED_TO_GET_SESSION.code
  );
}
