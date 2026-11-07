import { APIError, BASE_ERROR_CODES } from "better-auth";
import { notFound, redirect } from "next/navigation";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import { AuthenticationError, InfrastructureError } from "@/shared/domain/error-kinds";
import { requireActingUser } from "@/shared/application/require-acting-user";
import {
  createBetterAuthInstance,
  type BetterAuthInstance,
} from "@/shared/infrastructure/better-auth-instance";
import { createBetterAuthSessionReader } from "@/shared/infrastructure/better-auth-session-reader";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPrismaClient } from "@/shared/infrastructure/prisma-client";
import {
  createTestPrismaClient,
  emptyAuthenticationTables,
} from "../../support/database/test-database";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const TEST_AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
const TEST_AUTH_BASE_URL = "http://localhost:3000";
// Nothing listens on port 1, so every query against it fails at once.
const UNREACHABLE_DATABASE_URL = "postgresql://nobody:unreachable-secret@127.0.0.1:1/nowhere";
const SESSION_COOKIE_NAME = "better-auth.session_token";

let prismaClient: PrismaClient;
let betterAuthInstance: BetterAuthInstance;

function buildBetterAuthInstance(client: PrismaClient): BetterAuthInstance {
  return createBetterAuthInstance({
    environment: { authSecret: TEST_AUTH_SECRET, authBaseUrl: TEST_AUTH_BASE_URL },
    prismaClient: client,
  });
}

/** Signs an account up with the library, which leaves its session cookie in the emulated browser. */
async function signUpThroughTheLibrary(email: string): Promise<string> {
  const { user } = await betterAuthInstance.api.signUpEmail({
    body: { name: "Ana Torres", email, password: "correct horse" },
  });
  return user.id;
}

function buildSessionReader(getRequestHeaders: () => Promise<Headers>) {
  return createBetterAuthSessionReader({
    getBetterAuthInstance: () => betterAuthInstance,
    getRequestHeaders,
  });
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
});

describe("the Better Auth session reader with real cookies", () => {
  it("reads the account of the session cookie of the request (FR-20)", async () => {
    const signedUpUserId = await signUpThroughTheLibrary("ana@example.com");
    const sessionReader = buildSessionReader(async () => emulatedBrowser.buildRequestHeaders());

    expect(await sessionReader.readActiveSession()).toEqual({ userId: signedUpUserId });
  });

  it("reads no session when the request carries no cookie (FR-26)", async () => {
    await signUpThroughTheLibrary("ana@example.com");
    const sessionReader = buildSessionReader(async () => new Headers());

    expect(await sessionReader.readActiveSession()).toBeNull();
  });

  it("makes the acting-user check fail with an authentication error, not an infrastructure one, when there is no session (FR-20)", async () => {
    const sessionReader = buildSessionReader(async () => new Headers());

    await expect(requireActingUser({ sessionReader })).rejects.toBeInstanceOf(AuthenticationError);
  });

  describe("another account's identifier in the request (FR-21)", () => {
    it("is ignored when it travels in a header, in the query or in the body", async () => {
      const sessionUserId = await signUpThroughTheLibrary("ana@example.com");
      emulatedBrowser.clear();
      const otherUserId = await signUpThroughTheLibrary("lia@example.com");
      // The device holds the session of the second account; everything else in the request names the first.
      const forgedRequest = new Request(
        `${TEST_AUTH_BASE_URL}/anywhere?userId=${sessionUserId}&user_id=${sessionUserId}`,
        {
          method: "POST",
          headers: {
            cookie: `${SESSION_COOKIE_NAME}=${emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)}`,
            "x-user-id": sessionUserId,
            "x-forwarded-user": sessionUserId,
            authorization: `Bearer ${sessionUserId}`,
          },
          body: JSON.stringify({ userId: sessionUserId, user: { id: sessionUserId } }),
        },
      );
      const sessionReader = buildSessionReader(async () => forgedRequest.headers);

      const activeSession = await sessionReader.readActiveSession();

      expect(activeSession).toEqual({ userId: otherUserId });
      expect(activeSession?.userId).not.toBe(sessionUserId);
    });
  });

  describe("a session removed by a concurrent sign-out while it is renewed (FR-26)", () => {
    function buildReaderWhoseLibraryFailsWith(failure: unknown) {
      vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(failure);
      return buildSessionReader(async () => new Headers());
    }

    it("reads no session when the library answers 401 FAILED_TO_GET_SESSION", async () => {
      const sessionReader = buildReaderWhoseLibraryFailsWith(
        APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.FAILED_TO_GET_SESSION),
      );

      expect(await sessionReader.readActiveSession()).toBeNull();
    });

    it("still fails with an InfrastructureError for the same code with a 500, which is a real failure", async () => {
      const databaseFailure = new Error("connection lost");
      const sessionReader = buildReaderWhoseLibraryFailsWith(
        APIError.from("INTERNAL_SERVER_ERROR", BASE_ERROR_CODES.FAILED_TO_GET_SESSION, {
          cause: databaseFailure,
        }),
      );

      const failure = await sessionReader.readActiveSession().then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
    });

    it("still fails with an InfrastructureError for a 401 with another code", async () => {
      const sessionReader = buildReaderWhoseLibraryFailsWith(
        APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_TOKEN),
      );

      await expect(sessionReader.readActiveSession()).rejects.toBeInstanceOf(InfrastructureError);
    });
  });

  describe("framework control-flow signals", () => {
    it.each([
      ["a redirect", () => redirect("/somewhere"), "NEXT_REDIRECT"],
      ["a not found", () => notFound(), "NEXT_HTTP_ERROR_FALLBACK"],
    ])("rethrows %s thrown while the headers are read, as it is", async (_label, raiseSignal, digestPart) => {
      const sessionReader = buildSessionReader(async () => raiseSignal());

      const failure = await sessionReader.readActiveSession().then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(failure).not.toBeInstanceOf(InfrastructureError);
      expect(failure).toMatchObject({ digest: expect.stringContaining(digestPart) });
    });
  });

  describe("when the session cannot be checked (FR-22)", () => {
    let brokenSessionReader: ReturnType<typeof buildSessionReader>;

    beforeEach(async () => {
      await signUpThroughTheLibrary("ana@example.com");
      // Same secret, so the cookie is correctly signed and the library has to ask the database.
      const brokenInstance = buildBetterAuthInstance(createPrismaClient(UNREACHABLE_DATABASE_URL));
      brokenSessionReader = createBetterAuthSessionReader({
        getBetterAuthInstance: () => brokenInstance,
        getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
      });
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    async function captureFailure(work: Promise<unknown>): Promise<unknown> {
      return work.then(
        () => {
          throw new Error("Expected the read to fail, but it returned.");
        },
        (reason: unknown) => reason,
      );
    }

    it("fails with an InfrastructureError, never with null, a generic message and the cause kept", async () => {
      const failure = await captureFailure(brokenSessionReader.readActiveSession());

      expect(failure).toBeInstanceOf(InfrastructureError);
      const infrastructureFailure = failure as InfrastructureError;
      expect(infrastructureFailure.message).not.toMatch(/unreachable-secret|127\.0\.0\.1|nowhere|nobody/);
      expect(infrastructureFailure.cause).toBeDefined();
    });

    it("reaches the acting-user check as an infrastructure failure, not as an authentication error", async () => {
      const failure = await captureFailure(requireActingUser({ sessionReader: brokenSessionReader }));

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect(failure).not.toBeInstanceOf(AuthenticationError);
    });

    it("fails with an InfrastructureError when the headers of the request cannot be read", async () => {
      const failingHeadersCause = new Error("cookies() was called outside a request scope");
      const sessionReader = buildSessionReader(async () => {
        throw failingHeadersCause;
      });

      const failure = await captureFailure(sessionReader.readActiveSession());

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect((failure as InfrastructureError).cause).toBe(failingHeadersCause);
    });
  });
});
