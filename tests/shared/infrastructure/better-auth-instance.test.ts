import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { parseNewAccount } from "@/modules/accounts/domain/new-account";
import { createBetterAuthAccountAuthenticator } from "@/modules/accounts/infrastructure/better-auth-account-authenticator";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { SESSION_LIFETIME_IN_SECONDS } from "@/shared/domain/session-policy";
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
const SIGNED_UP_EMAIL = "ana@example.com";
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

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

async function signUpThrough(betterAuthInstance: BetterAuthInstance): Promise<void> {
  const authenticator = createBetterAuthAccountAuthenticator({
    getBetterAuthInstance: () => betterAuthInstance,
    getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
  });
  await authenticator.registerAndSignIn(
    parseNewAccount({
      displayName: "Ana Torres",
      email: SIGNED_UP_EMAIL,
      password: "correct horse",
      repeatPassword: "correct horse",
    }),
  );
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

describe("the account stored when a person signs up", () => {
  beforeEach(async () => {
    await emptyAuthenticationTables(prismaClient);
    emulatedBrowser.clear();
  });

  it("has a UUID identifier", async () => {
    await signUpThrough(buildInstance(HTTP_BASE_URL));

    const storedUser = await prismaClient.user.findUniqueOrThrow({ where: { email: SIGNED_UP_EMAIL } });
    expect(storedUser.id).toMatch(UUID_PATTERN);
  });
});

describe("the cookie as it is written when a person signs up", () => {
  beforeEach(async () => {
    await emptyAuthenticationTables(prismaClient);
    emulatedBrowser.clear();
  });

  async function signUpAndReadWrittenSessionCookie(authBaseUrl: string) {
    const betterAuthInstance = buildInstance(authBaseUrl);
    await signUpThrough(betterAuthInstance);
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

    let failure: unknown;
    try {
      getBetterAuthInstance();
    } catch (thrownFailure) {
      failure = thrownFailure;
    }

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure).toHaveProperty(
      "message",
      "Server environment is missing or invalid: DATABASE_URL, BETTER_AUTH_SECRET, BETTER_AUTH_URL",
    );
  });
});
