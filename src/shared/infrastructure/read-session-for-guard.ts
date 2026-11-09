import { unstable_rethrow } from "next/navigation";
import { createBetterAuthInstance, type BetterAuthInstance } from "./better-auth-instance";
import { isSessionRemovedWhileRenewing } from "./better-auth-session-reader";
import { getPrismaClient } from "./prisma-client";
import { readServerEnvironment } from "./server-environment";
import { logServerError } from "./server-error-logger";

export type GuardSessionState = "signed-in" | "signed-out" | "check-failed";

/**
 * What the page guard learns from one request: the state of its session and the cookie lines the
 * library produced while reading it (the renewed session cookie, FR-16 and FR-17, or the removal of
 * a dead one). The lines are complete `Set-Cookie` values; the guard puts them on its response.
 */
export type GuardSessionReading = {
  readonly state: GuardSessionState;
  readonly setCookieLines: readonly string[];
};

export type GuardSessionReaderDependencies = {
  /** Gives the library instance. Called on first use, so nothing is built at import (the proxy imports this file). */
  readonly getBetterAuthInstance: () => BetterAuthInstance;
};

const CHECK_FAILED_ERROR_CODE = "SESSION_CHECK_FAILED";

/**
 * Builds the reader the page guard uses. It asks the library for the session of the request
 * headers, in the database on every call (the cookie cache is off), and asks for the response
 * headers too, because a session in use past the renewal interval is extended and the browser has
 * to receive the new cookie (FR-16, FR-17). A session that is missing, deleted, expired or
 * tampered with is `signed-out`. Anything that goes wrong while checking is `check-failed` and is
 * logged: a session that cannot be checked is never read as signed out (FR-24).
 */
export function createGuardSessionReader(dependencies: GuardSessionReaderDependencies) {
  const { getBetterAuthInstance: getInstance } = dependencies;

  return async function readSessionForGuard(requestHeaders: Headers): Promise<GuardSessionReading> {
    try {
      const { headers: responseHeaders, response: sessionWithUser } =
        await getInstance().api.getSession({ headers: requestHeaders, returnHeaders: true });
      return {
        state: sessionWithUser === null ? "signed-out" : "signed-in",
        setCookieLines: responseHeaders.getSetCookie(),
      };
    } catch (failure) {
      unstable_rethrow(failure);
      if (isSessionRemovedWhileRenewing(failure)) {
        return { state: "signed-out", setCookieLines: [] };
      }
      logServerError(failure, { errorCode: CHECK_FAILED_ERROR_CODE });
      return { state: "check-failed", setCookieLines: [] };
    }
  };
}

// The proxy is bundled apart from the pages and the Server Actions, so it has its own copy of the
// library's code, but both live in one process and share `globalThis`. If the guard reused the
// application's instance (the one on the key of `better-auth-instance.ts`), whichever side built it
// first would leave the other with errors from a class it does not know: the `instanceof APIError`
// checks of the account engine then fail, and a wrong password reads as an infrastructure failure.
// So the guard keeps its own instance, on its own key, built with the same settings. The
// database client is still the single shared one: nothing checks its error classes.
const GUARD_BETTER_AUTH_INSTANCE_GLOBAL_KEY = Symbol.for("lorekeeper.guardBetterAuthInstance");

type GlobalWithGuardBetterAuthInstance = typeof globalThis & {
  [GUARD_BETTER_AUTH_INSTANCE_GLOBAL_KEY]?: BetterAuthInstance;
};

function getGuardBetterAuthInstance(): BetterAuthInstance {
  const globalScope = globalThis as GlobalWithGuardBetterAuthInstance;
  globalScope[GUARD_BETTER_AUTH_INSTANCE_GLOBAL_KEY] ??= createBetterAuthInstance({
    environment: readServerEnvironment(),
    prismaClient: getPrismaClient(),
  });
  return globalScope[GUARD_BETTER_AUTH_INSTANCE_GLOBAL_KEY];
}

/** The reader of the application's page gate, bound to the guard's own library instance. */
export const readSessionForGuard = createGuardSessionReader({
  getBetterAuthInstance: getGuardBetterAuthInstance,
});
