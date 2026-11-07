import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNewAccount } from "@/modules/accounts/domain/new-account";
import { createBetterAuthAccountAuthenticator } from "@/modules/accounts/infrastructure/better-auth-account-authenticator";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import {
  SESSION_LIFETIME_IN_SECONDS,
  SESSION_RENEWAL_INTERVAL_IN_SECONDS,
} from "@/shared/domain/session-policy";
import {
  createBetterAuthInstance,
  getBetterAuthInstance,
  type BetterAuthInstance,
} from "@/shared/infrastructure/better-auth-instance";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  createTestPrismaClient,
  emptyAuthenticationTables,
  requireTestDatabaseUrl,
} from "../../support/database/test-database";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const TEST_AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
const HTTP_BASE_URL = "http://localhost:3000";
const HTTPS_BASE_URL = "https://lorekeeper.example.com";

const BETTER_AUTH_INSTANCE_GLOBAL_KEY = Symbol.for("lorekeeper.betterAuthInstance");
const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");

let prismaClient: PrismaClient;

function buildInstance(authBaseUrl: string): BetterAuthInstance {
  return createBetterAuthInstance({
    environment: { authSecret: TEST_AUTH_SECRET, authBaseUrl },
    prismaClient,
  });
}

async function readSessionCookie(authBaseUrl: string) {
  const authContext = await buildInstance(authBaseUrl).$context;
  return authContext.authCookies.sessionToken;
}

beforeAll(() => {
  prismaClient = createTestPrismaClient();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

describe("the session cookie of the Better Auth instance", () => {
  it("is Secure, HttpOnly and SameSite=Strict for an https:// base URL (FR-27, FR-28, FR-29)", async () => {
    const sessionCookie = await readSessionCookie(HTTPS_BASE_URL);

    expect(sessionCookie.attributes).toMatchObject({ secure: true, httpOnly: true, sameSite: "strict" });
    expect(sessionCookie.name).toBe("__Secure-better-auth.session_token");
  });

  it("is not Secure for an http:// base URL, but still HttpOnly and SameSite=Strict", async () => {
    const sessionCookie = await readSessionCookie(HTTP_BASE_URL);

    expect(sessionCookie.attributes).toMatchObject({ secure: false, httpOnly: true, sameSite: "strict" });
    expect(sessionCookie.name).toBe("better-auth.session_token");
  });

  it("is persistent: it lives as long as the session policy says", async () => {
    const sessionCookie = await readSessionCookie(HTTP_BASE_URL);

    expect(sessionCookie.attributes.maxAge).toBe(SESSION_LIFETIME_IN_SECONDS);
  });
});

describe("the session settings of the Better Auth instance", () => {
  it("take the lifetime and the renewal interval from the session policy (FR-23, FR-24)", async () => {
    const authContext = await buildInstance(HTTP_BASE_URL).$context;

    expect(authContext.sessionConfig.expiresIn).toBe(SESSION_LIFETIME_IN_SECONDS);
    expect(authContext.sessionConfig.updateAge).toBe(SESSION_RENEWAL_INTERVAL_IN_SECONDS);
  });

  it("keep the cookie cache off, so a sign-out is effective at once (FR-16)", async () => {
    const authContext = await buildInstance(HTTP_BASE_URL).$context;

    expect(authContext.options.session?.cookieCache?.enabled).toBe(false);
  });

  it("generate UUID identifiers and sign in after sign-up, with no email verification", async () => {
    const authContext = await buildInstance(HTTP_BASE_URL).$context;

    expect(authContext.options.advanced?.database?.generateId).toBe("uuid");
    expect(authContext.options.emailAndPassword).toMatchObject({
      enabled: true,
      autoSignIn: true,
      requireEmailVerification: false,
    });
  });
});

describe("the cookie as it is written when a person signs up", () => {
  beforeEach(async () => {
    await emptyAuthenticationTables(prismaClient);
    emulatedBrowser.clear();
  });

  async function signUpAndReadWrittenSessionCookie(authBaseUrl: string) {
    const betterAuthInstance = buildInstance(authBaseUrl);
    const authenticator = createBetterAuthAccountAuthenticator({
      getBetterAuthInstance: () => betterAuthInstance,
      getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
    });
    await authenticator.registerAndSignIn(
      parseNewAccount({
        displayName: "Ana Torres",
        email: "ana@example.com",
        password: "correct horse",
        repeatPassword: "correct horse",
      }),
    );
    const sessionCookie = (await betterAuthInstance.$context).authCookies.sessionToken;
    return {
      sessionCookieName: sessionCookie.name,
      writtenOptions: emulatedBrowser.readLastWrittenOptions(sessionCookie.name),
    };
  }

  it("carries HttpOnly, SameSite=Strict and the lifetime, and no Secure over http", async () => {
    const { sessionCookieName, writtenOptions } = await signUpAndReadWrittenSessionCookie(HTTP_BASE_URL);

    expect(emulatedBrowser.readCookieValue(sessionCookieName)).not.toBeNull();
    expect(writtenOptions).toMatchObject({ httpOnly: true, maxAge: SESSION_LIFETIME_IN_SECONDS });
    expect(String(writtenOptions?.sameSite).toLowerCase()).toBe("strict");
    expect(writtenOptions?.secure).not.toBe(true);
  });

  it("carries Secure over https", async () => {
    const { sessionCookieName, writtenOptions } = await signUpAndReadWrittenSessionCookie(HTTPS_BASE_URL);

    expect(emulatedBrowser.readCookieValue(sessionCookieName)).not.toBeNull();
    expect(writtenOptions).toMatchObject({ httpOnly: true, secure: true });
    expect(String(writtenOptions?.sameSite).toLowerCase()).toBe("strict");
  });

  it("writes no session-data cookie, because the cookie cache is off", async () => {
    await signUpAndReadWrittenSessionCookie(HTTP_BASE_URL);

    const cookieNames = emulatedBrowser.cookieStore.getAll().map((cookie) => cookie.name);
    expect(cookieNames.filter((cookieName) => cookieName.includes("session_data"))).toEqual([]);
  });
});

describe("the application instance built on first use", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
    const globalScope = globalThis as Record<symbol, unknown>;
    delete globalScope[BETTER_AUTH_INSTANCE_GLOBAL_KEY];
    const applicationPrismaClient = globalScope[PRISMA_CLIENT_GLOBAL_KEY] as PrismaClient | undefined;
    delete globalScope[PRISMA_CLIENT_GLOBAL_KEY];
    return applicationPrismaClient?.$disconnect();
  });

  it("is built from the environment, only once, and sets Secure when BETTER_AUTH_URL is https (FR-29)", async () => {
    vi.stubEnv("DATABASE_URL", requireTestDatabaseUrl());
    vi.stubEnv("BETTER_AUTH_SECRET", TEST_AUTH_SECRET);
    vi.stubEnv("BETTER_AUTH_URL", HTTPS_BASE_URL);

    const firstInstance = getBetterAuthInstance();
    const secondInstance = getBetterAuthInstance();

    expect(secondInstance).toBe(firstInstance);
    expect((await firstInstance.$context).authCookies.sessionToken.attributes.secure).toBe(true);
  });

  it("fails with a generic InfrastructureError, naming no value, when the environment is missing", () => {
    vi.stubEnv("DATABASE_URL", "");
    vi.stubEnv("BETTER_AUTH_SECRET", "");
    vi.stubEnv("BETTER_AUTH_URL", "");

    expect(() => getBetterAuthInstance()).toThrow(InfrastructureError);
  });
});
