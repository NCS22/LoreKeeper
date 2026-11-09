import { APIError, BASE_ERROR_CODES } from "better-auth";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createBetterAuthInstance,
  type BetterAuthInstance,
} from "@/shared/infrastructure/better-auth-instance";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPrismaClient } from "@/shared/infrastructure/prisma-client";
import {
  createGuardSessionReader,
  type GuardSessionReading,
} from "@/shared/infrastructure/read-session-for-guard";
import { createTestPrismaClient, emptyAuthenticationTables } from "../../support/database/test-database";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const TEST_AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
const TEST_AUTH_BASE_URL = "http://localhost:3000";
// Nothing listens on port 1, so every query against it fails at once.
const UNREACHABLE_DATABASE_URL = "postgresql://nobody:unreachable-secret@127.0.0.1:1/nowhere";
const SESSION_COOKIE_NAME = "better-auth.session_token";
const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
const ONE_MINUTE_IN_MILLISECONDS = 60 * 1000;
const THIRTY_DAYS_IN_SECONDS = 30 * 24 * 60 * 60;

let prismaClient: PrismaClient;
let betterAuthInstance: BetterAuthInstance;

function buildBetterAuthInstance(client: PrismaClient): BetterAuthInstance {
  return createBetterAuthInstance({
    environment: { authSecret: TEST_AUTH_SECRET, authBaseUrl: TEST_AUTH_BASE_URL },
    prismaClient: client,
  });
}

/** Signs an account up with the library and returns the value of the session cookie it produced. */
async function signUpAndTakeSessionCookieValue(): Promise<string> {
  await betterAuthInstance.api.signUpEmail({
    body: { name: "Ana Torres", email: "ana@example.com", password: "correct horse" },
  });
  const sessionCookieValue = emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME);
  if (sessionCookieValue === null) {
    throw new Error("Signing up did not leave a session cookie in the emulated browser.");
  }
  return sessionCookieValue;
}

function buildRequestHeadersWithSessionCookie(sessionCookieValue: string | null): Headers {
  const requestHeaders = new Headers();
  if (sessionCookieValue !== null) {
    requestHeaders.set("cookie", `${SESSION_COOKIE_NAME}=${sessionCookieValue}`);
  }
  return requestHeaders;
}

function readGuardSession(
  sessionCookieValue: string | null,
  instance: BetterAuthInstance = betterAuthInstance,
): Promise<GuardSessionReading> {
  const readSessionForGuard = createGuardSessionReader({ getBetterAuthInstance: () => instance });
  return readSessionForGuard(buildRequestHeadersWithSessionCookie(sessionCookieValue));
}

function findSessionCookieLine(cookieLines: readonly string[]): string | undefined {
  return cookieLines.find((cookieLine) => cookieLine.startsWith(`${SESSION_COOKIE_NAME}=`));
}

beforeAll(() => {
  prismaClient = createTestPrismaClient();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

beforeEach(async () => {
  await emptyAuthenticationTables(prismaClient);
  emulatedBrowser.clear();
  betterAuthInstance = buildBetterAuthInstance(prismaClient);
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.useRealTimers();
});

describe("the session reader of the page guard", () => {
  describe("the state of the session (FR-15)", () => {
    it("is signed in for a valid session that needs no renewal, with no cookie lines", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();

      expect(await readGuardSession(sessionCookieValue)).toEqual({
        state: "signed-in",
        setCookieLines: [],
      });
    });

    it("is signed out when the request carries no cookie, with no cookie lines", async () => {
      await signUpAndTakeSessionCookieValue();

      expect(await readGuardSession(null)).toEqual({ state: "signed-out", setCookieLines: [] });
    });

    it("is signed out when the session was deleted from the database", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      await prismaClient.session.deleteMany();

      const reading = await readGuardSession(sessionCookieValue);

      expect(reading.state).toBe("signed-out");
    });

    it("is signed out when the cookie was tampered with", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      const tamperedCookieValue = `${sessionCookieValue.startsWith("A") ? "B" : "A"}${sessionCookieValue.slice(1)}`;

      const reading = await readGuardSession(tamperedCookieValue);

      expect(reading.state).toBe("signed-out");
    });

    it("is signed out when the session was unused for more than 30 days", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + 30 * ONE_DAY_IN_MILLISECONDS + ONE_MINUTE_IN_MILLISECONDS));

      const reading = await readGuardSession(sessionCookieValue);

      expect(reading.state).toBe("signed-out");
    });

    it("is signed out, not a failed check, when the library says a concurrent sign-out removed the session while renewing it (FR-26)", async () => {
      vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(
        APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.FAILED_TO_GET_SESSION),
      );

      expect(await readGuardSession("any")).toEqual({ state: "signed-out", setCookieLines: [] });
    });
  });

  describe("the cookie lines that must reach the browser (FR-16, FR-17)", () => {
    it("carries the renewed session cookie for a session used after 24 hours, with the properties of FR-17", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + ONE_DAY_IN_MILLISECONDS + ONE_MINUTE_IN_MILLISECONDS));

      const reading = await readGuardSession(sessionCookieValue);

      expect(reading.state).toBe("signed-in");
      const sessionCookieLine = findSessionCookieLine(reading.setCookieLines);
      expect(sessionCookieLine).toBeDefined();
      expect(sessionCookieLine).toContain(`Max-Age=${THIRTY_DAYS_IN_SECONDS}`);
      expect(sessionCookieLine).toContain("HttpOnly");
      expect(sessionCookieLine?.toLowerCase()).toContain("samesite=strict");
      expect(sessionCookieLine).toContain("Path=/");
      expect(sessionCookieLine).not.toContain("Secure");
    });

    it("extends the stored session when it renews it", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      const storedExpiryBeforeRenewal = (await prismaClient.session.findFirstOrThrow()).expiresAt;
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + ONE_DAY_IN_MILLISECONDS + ONE_MINUTE_IN_MILLISECONDS));

      await readGuardSession(sessionCookieValue);

      const storedExpiryAfterRenewal = (await prismaClient.session.findFirstOrThrow()).expiresAt;
      expect(storedExpiryAfterRenewal.getTime()).toBeGreaterThan(storedExpiryBeforeRenewal.getTime());
    });

    it("carries the removal of the cookies for a request whose session is dead", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      await prismaClient.session.deleteMany();

      const reading = await readGuardSession(sessionCookieValue);

      const sessionCookieLine = findSessionCookieLine(reading.setCookieLines);
      expect(sessionCookieLine).toContain("Max-Age=0");
    });

    it("carries the removal of the cookies for an expired session", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(new Date(Date.now() + 31 * ONE_DAY_IN_MILLISECONDS));

      const reading = await readGuardSession(sessionCookieValue);

      expect(reading.state).toBe("signed-out");
      expect(findSessionCookieLine(reading.setCookieLines)).toContain("Max-Age=0");
    });
  });

  describe("when the session cannot be checked (FR-24)", () => {
    it("is a failed check, never signed out, and the failure is logged", async () => {
      const sessionCookieValue = await signUpAndTakeSessionCookieValue();
      const logged = vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
      // Same secret, so the cookie is correctly signed and the library has to ask the database.
      const brokenInstance = buildBetterAuthInstance(createPrismaClient(UNREACHABLE_DATABASE_URL));

      const reading = await readGuardSession(sessionCookieValue, brokenInstance);

      expect(reading).toEqual({ state: "check-failed", setCookieLines: [] });
      expect(logged.mock.calls.some(([message]) => String(message).includes("SESSION_CHECK_FAILED"))).toBe(
        true,
      );
    });

    it("is a failed check for any unexpected failure of the library, and does not leak it in the reading", async () => {
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(new Error("secret internal detail"));

      const reading = await readGuardSession("any");

      expect(reading).toEqual({ state: "check-failed", setCookieLines: [] });
    });
  });
});
