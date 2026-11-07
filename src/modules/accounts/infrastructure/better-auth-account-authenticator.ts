import { APIError, BASE_ERROR_CODES } from "better-auth";
import { unstable_rethrow } from "next/navigation";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import type { BetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { isSessionRemovedWhileRenewing } from "@/shared/infrastructure/better-auth-session-reader";
import type { AccountAuthenticator } from "../application/account-authenticator";
import { EmailAlreadyRegisteredError, InvalidCredentialsError } from "../domain/account-errors";

export type BetterAuthAccountAuthenticatorDependencies = {
  /** Gives the library instance. Called on first use, so building it never happens at import. */
  readonly getBetterAuthInstance: () => BetterAuthInstance;
  /** The headers of the request being served, which carry the session cookie of the device in use. */
  readonly getRequestHeaders: () => Promise<Headers>;
};

// Library outcomes that mean "these credentials do not match an account". At sign-in the domain
// checks no format or length (FR-15), so a malformed email or an overlong password reaches the
// library and must get the same answer as an unknown email.
const CREDENTIAL_MISMATCH_CODES: ReadonlySet<string> = new Set([
  BASE_ERROR_CODES.INVALID_EMAIL_OR_PASSWORD.code,
  BASE_ERROR_CODES.INVALID_EMAIL.code,
  BASE_ERROR_CODES.PASSWORD_TOO_LONG.code,
]);

const EMAIL_ALREADY_EXISTS_CODES: ReadonlySet<string> = new Set([
  BASE_ERROR_CODES.USER_ALREADY_EXISTS.code,
  BASE_ERROR_CODES.USER_ALREADY_EXISTS_USE_ANOTHER_EMAIL.code,
]);

function readLibraryErrorCode(failure: unknown): string | undefined {
  return failure instanceof APIError ? failure.body?.code : undefined;
}

/** Keeps an `InfrastructureError` as it is and wraps anything else, keeping the original failure as the cause for the log. */
function toInfrastructureError(failure: unknown, operation: string): InfrastructureError {
  if (failure instanceof InfrastructureError) {
    return failure;
  }
  return new InfrastructureError(`The account engine failed while trying to ${operation}.`, {
    cause: failure,
  });
}

/** Implements the port with the Better Auth server API (the HTTP handler of the library is not mounted). */
export function createBetterAuthAccountAuthenticator(
  dependencies: BetterAuthAccountAuthenticatorDependencies,
): AccountAuthenticator {
  const { getBetterAuthInstance, getRequestHeaders } = dependencies;

  async function comparableEmailIsRegistered(comparableEmail: string): Promise<boolean> {
    const authContext = await getBetterAuthInstance().$context;
    const registeredUser = await authContext.internalAdapter.findUserByEmail(comparableEmail);
    return registeredUser !== null;
  }

  /**
   * A sign-up that failed for any reason other than a plain "already exists" may have lost a
   * race against another sign-up with the same email (the unique constraint refused the second
   * insert). Looking again tells that case from a real failure (FR-11).
   */
  async function translateSignUpFailure(
    failure: unknown,
    comparableEmail: string,
  ): Promise<Error> {
    if (EMAIL_ALREADY_EXISTS_CODES.has(readLibraryErrorCode(failure) ?? "")) {
      return new EmailAlreadyRegisteredError();
    }
    try {
      if (await comparableEmailIsRegistered(comparableEmail)) {
        return new EmailAlreadyRegisteredError();
      }
    } catch (lookupFailure) {
      // The second look failed too: both failures travel in the cause, for the log.
      return toInfrastructureError(
        new AggregateError([failure, lookupFailure], "Sign-up failed and the re-check failed too."),
        "register the account",
      );
    }
    return toInfrastructureError(failure, "register the account");
  }

  return {
    async registerAndSignIn(newAccount) {
      try {
        await getBetterAuthInstance().api.signUpEmail({
          body: {
            name: newAccount.displayName,
            email: newAccount.email,
            password: newAccount.password,
          },
        });
      } catch (failure) {
        throw await translateSignUpFailure(failure, newAccount.email);
      }
    },

    async signInWithPassword(credentials) {
      try {
        await getBetterAuthInstance().api.signInEmail({
          body: { email: credentials.email, password: credentials.password },
        });
      } catch (failure) {
        if (CREDENTIAL_MISMATCH_CODES.has(readLibraryErrorCode(failure) ?? "")) {
          throw new InvalidCredentialsError();
        }
        throw toInfrastructureError(failure, "sign in");
      }
    },

    /**
     * The library's own sign-out only logs a failed deletion of the session row, clears the cookie
     * and reports success, which would leave a valid session on the server (FR-16). So the row is
     * deleted here first and a failure is visible; only after that the library clears the cookie.
     * If the deletion fails the cookie stays, so the person can try again.
     */
    async signOutCurrentSession() {
      try {
        const betterAuthInstance = getBetterAuthInstance();
        const requestHeaders = await getRequestHeaders();
        const activeSession = await readSessionOfRequest(betterAuthInstance, requestHeaders);
        if (activeSession !== null) {
          const authContext = await betterAuthInstance.$context;
          await authContext.internalAdapter.deleteSession(activeSession.session.token);
        }
        // A request with no session cookie, or with one that no longer matches a session, is a success:
        // the library only clears the cookie.
        await betterAuthInstance.api.signOut({ headers: requestHeaders });
      } catch (failure) {
        // Next.js control-flow signals (dynamic rendering, redirect, not found) are not failures.
        unstable_rethrow(failure);
        throw toInfrastructureError(failure, "sign out");
      }
    },
  };
}

/**
 * The session the request's cookie points at, or `null` when there is none. When a session is
 * past its renewal interval the library renews it inside this call, and if a concurrent sign-out
 * removed the session meanwhile it answers 401 `FAILED_TO_GET_SESSION`: the session has already
 * ended, which is what this sign-out wanted (FR-18), so it counts as no session, like the session
 * reader does. The same code with a 500 is a real database failure and propagates.
 */
async function readSessionOfRequest(betterAuthInstance: BetterAuthInstance, requestHeaders: Headers) {
  try {
    return await betterAuthInstance.api.getSession({ headers: requestHeaders });
  } catch (failure) {
    if (isSessionRemovedWhileRenewing(failure)) {
      return null;
    }
    throw failure;
  }
}
