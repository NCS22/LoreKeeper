import { afterAll, afterEach, beforeAll, beforeEach, vi } from "vitest";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import {
  clearEmulatedRequestHeaders,
  emulatedBrowser,
  setEmulatedRequestHeader,
} from "../emulated-next-headers";
import { createTestPrismaClient, emptyAuthenticationTables, requireTestDatabaseUrl } from "./test-database";

// The same keys the application uses to keep its single Prisma client and library instance.
const BETTER_AUTH_INSTANCE_GLOBAL_KEY = Symbol.for("lorekeeper.betterAuthInstance");
const PRISMA_CLIENT_GLOBAL_KEY = Symbol.for("lorekeeper.prismaClient");

const TEST_AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
const TEST_AUTH_BASE_URL = "http://localhost:3000";

/** The name of the session cookie for an `http://` base URL (no `__Secure-` prefix). */
export const TEST_SESSION_COOKIE_NAME = "better-auth.session_token";

/** The host of `TEST_AUTH_BASE_URL`, as a browser sends it in `Host` and in `Origin`. */
export const TEST_SERVER_HOST = "localhost:3000";
export const TEST_SERVER_ORIGIN = TEST_AUTH_BASE_URL;

/** Makes the next emulated requests look like they come from a page of the application itself. */
export function emulateRequestFromThisSite(): void {
  setEmulatedRequestHeader("host", TEST_SERVER_HOST);
  setEmulatedRequestHeader("origin", TEST_SERVER_ORIGIN);
  setEmulatedRequestHeader("sec-fetch-site", "same-origin");
}

/** The two ways a request from another site shows itself; each one makes the next requests look like that. */
export const CROSS_SITE_REQUEST_EMULATIONS: ReadonlyArray<{
  readonly label: string;
  readonly emulate: () => void;
}> = [
  {
    label: "a foreign Origin",
    emulate() {
      setEmulatedRequestHeader("host", TEST_SERVER_HOST);
      setEmulatedRequestHeader("origin", "https://evil.example");
    },
  },
  {
    label: "Sec-Fetch-Site: cross-site",
    emulate() {
      setEmulatedRequestHeader("host", TEST_SERVER_HOST);
      setEmulatedRequestHeader("sec-fetch-site", "cross-site");
    },
  },
];

type GlobalScopeWithSingletons = Record<symbol, { $disconnect?: () => Promise<void> } | undefined>;

/**
 * Forgets the Prisma client and the library instance the application keeps for itself, closing the
 * connections of the client, so the next use builds them again from the current environment.
 */
async function forgetApplicationSingletons(): Promise<void> {
  const globalScope = globalThis as unknown as GlobalScopeWithSingletons;
  const applicationPrismaClient = globalScope[PRISMA_CLIENT_GLOBAL_KEY];
  delete globalScope[BETTER_AUTH_INSTANCE_GLOBAL_KEY];
  delete globalScope[PRISMA_CLIENT_GLOBAL_KEY];
  await applicationPrismaClient?.$disconnect?.();
}

/**
 * Points the real composition of the application (its own environment, Prisma client and Better
 * Auth instance, built on first use) at the test database, and gives every test an empty
 * database, an empty emulated browser and no extra request headers. Call it once at the top of a
 * test file that also replaces `next/headers` with the emulated one.
 *
 * Returns a reader of the client the test uses to look at the stored rows.
 */
export function prepareRealCompositionOverTestDatabase(): { readStoredRowsClient(): PrismaClient } {
  let storedRowsClient: PrismaClient | undefined;

  beforeAll(async () => {
    vi.stubEnv("DATABASE_URL", requireTestDatabaseUrl());
    vi.stubEnv("BETTER_AUTH_SECRET", TEST_AUTH_SECRET);
    vi.stubEnv("BETTER_AUTH_URL", TEST_AUTH_BASE_URL);
    await forgetApplicationSingletons();
    storedRowsClient = createTestPrismaClient();
  });

  afterAll(async () => {
    await forgetApplicationSingletons();
    await storedRowsClient?.$disconnect();
    vi.unstubAllEnvs();
  });

  beforeEach(async () => {
    await emptyAuthenticationTables(readStoredRowsClient());
    emulatedBrowser.clear();
    clearEmulatedRequestHeaders();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  function readStoredRowsClient(): PrismaClient {
    if (storedRowsClient === undefined) {
      throw new Error("The test database client is not ready yet.");
    }
    return storedRowsClient;
  }

  return { readStoredRowsClient };
}
