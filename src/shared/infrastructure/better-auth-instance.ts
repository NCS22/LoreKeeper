import { betterAuth } from "better-auth";
import { prismaAdapter } from "better-auth/adapters/prisma";
import { nextCookies } from "better-auth/next-js";
import {
  SESSION_LIFETIME_IN_SECONDS,
  SESSION_RENEWAL_INTERVAL_IN_SECONDS,
} from "@/shared/domain/session-policy";
import type { PrismaClient } from "./generated/prisma/client";
import { getPrismaClient } from "./prisma-client";
import { readServerEnvironment, type ServerEnvironment } from "./server-environment";
import { hashPasswordAsTyped, verifyPasswordAsTyped } from "./scrypt-password-hasher";

// The library counts password length in UTF-16 units; the domain counts code points and allows
// up to 128, which can take 256 units. The library's own limits are only widened out of the way
// so the domain rule (account-password.ts) is the single definition of the password length.
const LIBRARY_MINIMUM_PASSWORD_LENGTH = 1;
const LIBRARY_MAXIMUM_PASSWORD_LENGTH = 256;

export type BetterAuthInstanceSettings = {
  readonly environment: Pick<ServerEnvironment, "authSecret" | "authBaseUrl">;
  readonly prismaClient: PrismaClient;
};

/** Whether the session cookie must carry `Secure`: exactly when the application is served over HTTPS (FR-29). */
function isSecureConnection(authBaseUrl: string): boolean {
  return authBaseUrl.startsWith("https://");
}

/**
 * The one Better Auth configuration of the application. Only the server API is used: the HTTP
 * handler of the library is not mounted, so no `/api/auth/*` surface exists (plan decision D15).
 * The cookie plugin must stay the last plugin.
 */
export function createBetterAuthInstance(settings: BetterAuthInstanceSettings) {
  const { environment, prismaClient } = settings;
  const isSecure = isSecureConnection(environment.authBaseUrl);

  return betterAuth({
    secret: environment.authSecret,
    baseURL: environment.authBaseUrl,
    // The adapter's transaction option defaults to off. With it on, the user, the credential and the
    // session of a sign-up are written together or not at all (FR-1, FR-9).
    database: prismaAdapter(prismaClient, { provider: "postgresql", transaction: true }),
    emailAndPassword: {
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
      minPasswordLength: LIBRARY_MINIMUM_PASSWORD_LENGTH,
      maxPasswordLength: LIBRARY_MAXIMUM_PASSWORD_LENGTH,
      password: { hash: hashPasswordAsTyped, verify: verifyPasswordAsTyped },
    },
    session: {
      expiresIn: SESSION_LIFETIME_IN_SECONDS,
      updateAge: SESSION_RENEWAL_INTERVAL_IN_SECONDS,
      // A signed copy of the session in the cookie would stay accepted after a sign-out (FR-16).
      cookieCache: { enabled: false },
    },
    advanced: {
      useSecureCookies: isSecure,
      defaultCookieAttributes: { httpOnly: true, sameSite: "strict", secure: isSecure },
      database: { generateId: "uuid" },
    },
    plugins: [nextCookies()],
  });
}

export type BetterAuthInstance = ReturnType<typeof createBetterAuthInstance>;

// Hot reloads in development re-evaluate modules; the instance lives on `globalThis`
// so every reload reuses one instance.
const BETTER_AUTH_INSTANCE_GLOBAL_KEY = Symbol.for("lorekeeper.betterAuthInstance");

type GlobalWithBetterAuthInstance = typeof globalThis & {
  [BETTER_AUTH_INSTANCE_GLOBAL_KEY]?: BetterAuthInstance;
};

/**
 * The single library instance of the application, built on first use (never at import, so the
 * application starts and builds without a database or a `.env`).
 */
export function getBetterAuthInstance(): BetterAuthInstance {
  const globalScope = globalThis as GlobalWithBetterAuthInstance;
  globalScope[BETTER_AUTH_INSTANCE_GLOBAL_KEY] ??= createBetterAuthInstance({
    environment: readServerEnvironment(),
    prismaClient: getPrismaClient(),
  });
  return globalScope[BETTER_AUTH_INSTANCE_GLOBAL_KEY];
}
