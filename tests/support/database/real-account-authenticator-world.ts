import { vi } from "vitest";
import { createBetterAuthAccountAuthenticator } from "@/modules/accounts/infrastructure/better-auth-account-authenticator";
import type { BetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { createBetterAuthSessionReader } from "@/shared/infrastructure/better-auth-session-reader";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import type { AccountAuthenticatorWorld } from "../contracts/account-authenticator-contract";
import { emulatedBrowser } from "../emulated-next-headers";

/**
 * The real engine (Better Auth over PostgreSQL) as a world for the contract suite. The device in
 * use is the emulated browser: the library writes the session cookie into it through the replaced
 * `next/headers`, and every read and every sign-out sends it back.
 *
 * The session reader is the real one of the application, reading the headers of the emulated
 * browser. The clock of the world (`setTime`) moves only `Date`, which is what the library reads.
 */
export async function createRealAccountAuthenticatorWorld(dependencies: {
  readonly betterAuthInstance: BetterAuthInstance;
  readonly prismaClient: PrismaClient;
}): Promise<AccountAuthenticatorWorld> {
  const { betterAuthInstance, prismaClient } = dependencies;
  const authContext = await betterAuthInstance.$context;
  const sessionCookieName = authContext.authCookies.sessionToken.name;

  const sessionReader = createBetterAuthSessionReader({
    getBetterAuthInstance: () => betterAuthInstance,
    getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
  });

  return {
    accountAuthenticator: createBetterAuthAccountAuthenticator({
      getBetterAuthInstance: () => betterAuthInstance,
      getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
    }),
    sessionReader,
    getCurrentSessionToken: () => emulatedBrowser.readCookieValue(sessionCookieName),
    holdSessionToken(sessionToken) {
      if (sessionToken === null) {
        emulatedBrowser.cookieStore.delete(sessionCookieName);
      } else {
        emulatedBrowser.holdCookie(sessionCookieName, sessionToken);
      }
    },
    async readAccountByEmail(comparableEmail) {
      const storedUser = await prismaClient.user.findUnique({ where: { email: comparableEmail } });
      return storedUser === null
        ? null
        : { userId: storedUser.id, displayName: storedUser.name, email: storedUser.email };
    },
    countAccounts: () => prismaClient.user.count(),
    setTime(time) {
      // Only the clock the library reads is moved; timers stay real so the database driver works.
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(time);
    },
  };
}
