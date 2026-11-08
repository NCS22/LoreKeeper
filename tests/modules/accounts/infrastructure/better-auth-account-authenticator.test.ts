import { inspect } from "node:util";
import { APIError, BASE_ERROR_CODES } from "better-auth";
import { notFound, redirect } from "next/navigation";
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";
import type { AccountAuthenticator } from "@/modules/accounts/application/account-authenticator";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "@/modules/accounts/domain/account-errors";
import { parseNewAccount } from "@/modules/accounts/domain/new-account";
import { parseSignInCredentials } from "@/modules/accounts/domain/sign-in-credentials";
import { createBetterAuthAccountAuthenticator } from "@/modules/accounts/infrastructure/better-auth-account-authenticator";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import {
  createBetterAuthInstance,
  type BetterAuthInstance,
} from "@/shared/infrastructure/better-auth-instance";
import { createBetterAuthSessionReader } from "@/shared/infrastructure/better-auth-session-reader";
import type { PrismaClient } from "@/shared/infrastructure/generated/prisma/client";
import { createPrismaClient } from "@/shared/infrastructure/prisma-client";
import { NOT_VALID_EMAIL_EXAMPLES } from "../../../support/account-email-examples";
import { describeAccountAuthenticatorContract } from "../../../support/contracts/account-authenticator-contract";
import {
  createTestPrismaClient,
  emptyAuthenticationTables,
} from "../../../support/database/test-database";
import { createRealAccountAuthenticatorWorld } from "../../../support/database/real-account-authenticator-world";
import { emulatedBrowser } from "../../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const TEST_AUTH_SECRET = "test-only-secret-that-is-at-least-32-characters-long";
const TEST_AUTH_BASE_URL = "http://localhost:3000";
// Nothing listens on port 1, so every query against it fails at once.
const UNREACHABLE_DATABASE_URL = "postgresql://nobody:unreachable-secret@127.0.0.1:1/nowhere";
const SESSION_COOKIE_NAME = "better-auth.session_token";

let prismaClient: PrismaClient;

function buildBetterAuthInstance(client: PrismaClient): BetterAuthInstance {
  return createBetterAuthInstance({
    environment: { authSecret: TEST_AUTH_SECRET, authBaseUrl: TEST_AUTH_BASE_URL },
    prismaClient: client,
  });
}

function buildAuthenticator(betterAuthInstance: BetterAuthInstance): AccountAuthenticator {
  return createBetterAuthAccountAuthenticator({
    getBetterAuthInstance: () => betterAuthInstance,
    getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
  });
}

beforeAll(() => {
  prismaClient = createTestPrismaClient();
});

afterAll(async () => {
  await prismaClient.$disconnect();
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
});

describeAccountAuthenticatorContract("Better Auth over PostgreSQL", async () => {
  await emptyAuthenticationTables(prismaClient);
  emulatedBrowser.clear();
  return createRealAccountAuthenticatorWorld({
    betterAuthInstance: buildBetterAuthInstance(prismaClient),
    prismaClient,
  });
});

function signUpRequest(email: string, password = "correct horse") {
  return parseNewAccount({
    displayName: "Ana Torres",
    email,
    password,
    repeatPassword: password,
  });
}

describe("Better Auth over PostgreSQL: what the contract does not cover", () => {
  let betterAuthInstance: BetterAuthInstance;
  let accountAuthenticator: AccountAuthenticator;

  beforeEach(async () => {
    await emptyAuthenticationTables(prismaClient);
    emulatedBrowser.clear();
    betterAuthInstance = buildBetterAuthInstance(prismaClient);
    accountAuthenticator = buildAuthenticator(betterAuthInstance);
  });

  describe("two sign-ups with the same email at the same moment (FR-11)", () => {
    it("create exactly one account and the others get EmailAlreadyRegisteredError", async () => {
      const ROUNDS = 5;
      for (let round = 0; round < ROUNDS; round += 1) {
        const typedEmails = [
          `race${round}@example.com`,
          `  RACE${round}@example.com`,
          `Race${round}@Example.com  `,
        ];

        const outcomes = await Promise.allSettled(
          typedEmails.map((typedEmail) =>
            accountAuthenticator.registerAndSignIn(signUpRequest(typedEmail)),
          ),
        );

        const fulfilledCount = outcomes.filter((outcome) => outcome.status === "fulfilled").length;
        const rejectedReasons = outcomes.flatMap((outcome) =>
          outcome.status === "rejected" ? [outcome.reason as unknown] : [],
        );
        expect(fulfilledCount).toBe(1);
        expect(rejectedReasons).toHaveLength(typedEmails.length - 1);
        for (const reason of rejectedReasons) {
          expect(reason).toBeInstanceOf(EmailAlreadyRegisteredError);
        }
        expect(await prismaClient.user.count({ where: { email: `race${round}@example.com` } })).toBe(1);
      }
    });

    it("answers EmailAlreadyRegisteredError to the loser of the race, whose first look found nothing", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      emulatedBrowser.clear();
      const authContext = await betterAuthInstance.$context;
      // The loser's first look happens before the winner's insert: it finds nothing, then the unique constraint refuses the insert.
      vi.spyOn(authContext.internalAdapter, "findUserByEmail").mockImplementationOnce(async () => null);

      const failure = await accountAuthenticator
        .registerAndSignIn(signUpRequest("ana@example.com"))
        .then(
          () => undefined,
          (reason: unknown) => reason,
        );

      expect(failure).toBeInstanceOf(EmailAlreadyRegisteredError);
      expect(await prismaClient.user.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue("better-auth.session_token")).toBeNull();
    });
  });

  describe("a sign-up that fails in the middle is all or nothing (FR-1, FR-9)", () => {
    const STEPS_THAT_WRITE_BEFORE_FAILING = ["linkAccount", "createSession"] as const;

    /**
     * Makes the next call of one step of the library really write its row and then fail, as a
     * database error right after the write would. The earlier steps of the same sign-up have
     * already written their rows by then, so a sign-up that is not atomic leaves them behind.
     */
    async function makeNextStepWriteAndThenFail(
      step: (typeof STEPS_THAT_WRITE_BEFORE_FAILING)[number],
    ): Promise<void> {
      const { internalAdapter } = await betterAuthInstance.$context;
      const injectedFailure = new Error("injected failure after the write");
      if (step === "linkAccount") {
        const writeAccount = internalAdapter.linkAccount.bind(internalAdapter);
        vi.spyOn(internalAdapter, "linkAccount").mockImplementationOnce(async (...writeArguments) => {
          await writeAccount(...writeArguments);
          throw injectedFailure;
        });
        return;
      }
      const writeSession = internalAdapter.createSession.bind(internalAdapter);
      vi.spyOn(internalAdapter, "createSession").mockImplementationOnce(async (...writeArguments) => {
        await writeSession(...writeArguments);
        throw injectedFailure;
      });
    }

    it.each(STEPS_THAT_WRITE_BEFORE_FAILING)(
      "leaves no User, Account or Session when %s fails, answers InfrastructureError and lets the same email sign up afterwards",
      async (failingStep) => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        await makeNextStepWriteAndThenFail(failingStep);

        const failure = await accountAuthenticator
          .registerAndSignIn(signUpRequest("ana@example.com"))
          .then(
            () => undefined,
            (reason: unknown) => reason,
          );

        expect(failure).toBeInstanceOf(InfrastructureError);
        expect(failure).not.toBeInstanceOf(EmailAlreadyRegisteredError);
        expect(await prismaClient.user.count()).toBe(0);
        expect(await prismaClient.account.count()).toBe(0);
        expect(await prismaClient.session.count()).toBe(0);
        expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();

        await expect(
          accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com")),
        ).resolves.toBeUndefined();
        expect(await prismaClient.user.count()).toBe(1);
        expect(await prismaClient.account.count()).toBe(1);
        expect(await prismaClient.session.count()).toBe(1);
        expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).not.toBeNull();
      },
    );
  });

  describe("sign-out when the server cannot end the session (FR-16, FR-18)", () => {
    it("ends the session row and clears the cookie in the normal case", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      expect(await prismaClient.session.count()).toBe(1);

      await accountAuthenticator.signOutCurrentSession();

      expect(await prismaClient.session.count()).toBe(0);
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();
    });

    it("fails with an InfrastructureError, keeps the session row and does not clear the cookie when the deletion fails", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      const cookieBeforeSignOut = emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME);
      expect(cookieBeforeSignOut).not.toBeNull();
      const { internalAdapter } = await betterAuthInstance.$context;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(internalAdapter, "deleteSession").mockRejectedValue(
        new Error("connection lost at unreachable-secret"),
      );

      const failure = await accountAuthenticator.signOutCurrentSession().then(
        () => undefined,
        (reason: unknown) => reason,
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
      const infrastructureFailure = failure as InfrastructureError;
      expect(infrastructureFailure.message).not.toContain("unreachable-secret");
      expect(infrastructureFailure.cause).toBeDefined();
      expect(await prismaClient.session.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBe(cookieBeforeSignOut);
    });

    it("can be retried: once the deletion works again the same cookie ends the session", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      const { internalAdapter } = await betterAuthInstance.$context;
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(internalAdapter, "deleteSession").mockRejectedValueOnce(new Error("connection lost"));

      await expect(accountAuthenticator.signOutCurrentSession()).rejects.toBeInstanceOf(
        InfrastructureError,
      );
      await accountAuthenticator.signOutCurrentSession();

      expect(await prismaClient.session.count()).toBe(0);
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();
    });

    it("is still a success without a session, with an unknown token and when repeated (FR-18)", async () => {
      await expect(accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();

      emulatedBrowser.holdCookie(SESSION_COOKIE_NAME, "not-a-real-token.not-a-real-signature");
      await expect(accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();

      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      await accountAuthenticator.signOutCurrentSession();
      await expect(accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();
    });

    describe("when the library fails to read the session it is about to end", () => {
      beforeEach(async () => {
        await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      });

      it("succeeds and clears the cookie when a concurrent sign-out removed the session while it was renewed (401 FAILED_TO_GET_SESSION)", async () => {
        vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(
          APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.FAILED_TO_GET_SESSION),
        );

        await expect(accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();

        expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();
      });

      it("still fails with an InfrastructureError for the same code with a 500, and keeps the cookie", async () => {
        const cookieBeforeSignOut = emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME);
        const databaseFailure = new Error("connection lost");
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(
          APIError.from("INTERNAL_SERVER_ERROR", BASE_ERROR_CODES.FAILED_TO_GET_SESSION, {
            cause: databaseFailure,
          }),
        );

        const failure = await accountAuthenticator.signOutCurrentSession().then(
          () => undefined,
          (reason: unknown) => reason,
        );

        expect(failure).toBeInstanceOf(InfrastructureError);
        expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBe(cookieBeforeSignOut);
        expect(await prismaClient.session.count()).toBe(1);
      });

      it("still fails with an InfrastructureError for a 401 with another code", async () => {
        vi.spyOn(console, "error").mockImplementation(() => undefined);
        vi.spyOn(betterAuthInstance.api, "getSession").mockRejectedValue(
          APIError.from("UNAUTHORIZED", BASE_ERROR_CODES.INVALID_TOKEN),
        );

        await expect(accountAuthenticator.signOutCurrentSession()).rejects.toBeInstanceOf(
          InfrastructureError,
        );
      });
    });

    it.each([
      ["a redirect", () => redirect("/somewhere"), "NEXT_REDIRECT"],
      ["a not found", () => notFound(), "NEXT_HTTP_ERROR_FALLBACK"],
    ])(
      "rethrows %s thrown while the headers are read, as it is, and does not disguise it as an InfrastructureError",
      async (_label, raiseSignal, digestPart) => {
        const authenticatorWhoseHeadersSignal = createBetterAuthAccountAuthenticator({
          getBetterAuthInstance: () => betterAuthInstance,
          getRequestHeaders: async () => raiseSignal(),
        });

        const failure = await authenticatorWhoseHeadersSignal.signOutCurrentSession().then(
          () => undefined,
          (reason: unknown) => reason,
        );

        expect(failure).not.toBeInstanceOf(InfrastructureError);
        expect(failure).toMatchObject({ digest: expect.stringContaining(digestPart) });
      },
    );

    it("ends a session whose renewal is pending: more than 24 hours since its last renewal (FR-16, FR-23)", async () => {
      const ONE_DAY_IN_MILLISECONDS = 24 * 60 * 60 * 1000;
      const signUpTime = new Date("2026-03-01T12:00:00.000Z");
      vi.useFakeTimers({ toFake: ["Date"] });
      vi.setSystemTime(signUpTime);
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      expect(await prismaClient.session.count()).toBe(1);
      const { internalAdapter } = await betterAuthInstance.$context;
      const renewalSpy = vi.spyOn(internalAdapter, "updateSession");
      vi.setSystemTime(new Date(signUpTime.getTime() + ONE_DAY_IN_MILLISECONDS + 60 * 60 * 1000));

      await expect(accountAuthenticator.signOutCurrentSession()).resolves.toBeUndefined();

      // The library renewed the session while reading it, and the sign-out still ended it.
      expect(renewalSpy).toHaveBeenCalled();
      expect(await prismaClient.session.count()).toBe(0);
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();
    });

    it("ends only the session of this device (FR-17)", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      const firstDeviceCookie = emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME);
      emulatedBrowser.clear();
      await accountAuthenticator.signInWithPassword(
        parseSignInCredentials({ email: "ana@example.com", password: "correct horse" }),
      );
      expect(await prismaClient.session.count()).toBe(2);

      await accountAuthenticator.signOutCurrentSession();

      expect(await prismaClient.session.count()).toBe(1);
      emulatedBrowser.holdCookie(SESSION_COOKIE_NAME, firstDeviceCookie ?? "");
      const sessionReader = createBetterAuthSessionReader({
        getBetterAuthInstance: () => betterAuthInstance,
        getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
      });
      expect(await sessionReader.readActiveSession()).not.toBeNull();
    });
  });

  describe("sign-in with values the domain does not check (FR-15)", () => {
    beforeEach(async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      emulatedBrowser.clear();
    });

    it.each([
      ["a malformed email", "not an email", "correct horse"],
      ["a 3-character password", "ana@example.com", "abc"],
      ["a very long password", "ana@example.com", "x".repeat(5000)],
    ])("answers %s with the credential error and starts no session", async (_label, email, password) => {
      const failure = await accountAuthenticator
        .signInWithPassword(parseSignInCredentials({ email, password }))
        .then(
          () => undefined,
          (reason: unknown) => reason,
        );

      expect(failure).toBeInstanceOf(InvalidCredentialsError);
      expect(emulatedBrowser.readCookieValue("better-auth.session_token")).toBeNull();
    });
  });

  describe("the engine's own email check against the not-valid examples of the spec (FR-5, NFR-1)", () => {
    it.each(NOT_VALID_EMAIL_EXAMPLES)(
      "refuses %s when it is sent to the engine directly, and creates no account",
      async (notValidEmail) => {
        const failure = await betterAuthInstance.api
          .signUpEmail({
            body: { name: "Ana Torres", email: notValidEmail, password: "correct horse" },
          })
          .then(
            () => undefined,
            (reason: unknown) => reason,
          );

        expect(failure).toMatchObject({ statusCode: 400 });
        expect(await prismaClient.user.count()).toBe(0);
        expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).toBeNull();
      },
    );
  });

  describe("the password rule of the domain is the only one (FR-8, NFR-1)", () => {
    it("accepts the longest password the domain allows, 128 code points that take 256 UTF-16 units", async () => {
      const longestPassword = "\u{1F600}".repeat(128);
      expect(longestPassword.length).toBe(256);

      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com", longestPassword));
      emulatedBrowser.clear();

      await expect(
        accountAuthenticator.signInWithPassword(
          parseSignInCredentials({ email: "ana@example.com", password: longestPassword }),
        ),
      ).resolves.toBeUndefined();
    });
  });

  describe("a new connection and a new library instance see what was stored (FR-31, automated part)", () => {
    let secondPrismaClient: PrismaClient;

    beforeEach(() => {
      secondPrismaClient = createTestPrismaClient();
    });

    afterEach(async () => {
      await secondPrismaClient.$disconnect();
    });

    it("finds the account and the session created before, and signs in again with the same password", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com"));
      const sessionToken = emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME);
      const storedAccount = await prismaClient.user.findUniqueOrThrow({
        where: { email: "ana@example.com" },
      });

      // What a restart leaves: nothing from the first client or the first instance, only the stored rows.
      const secondInstance = buildBetterAuthInstance(secondPrismaClient);
      const sessionReaderAfterRestart = createBetterAuthSessionReader({
        getBetterAuthInstance: () => secondInstance,
        getRequestHeaders: async () => emulatedBrowser.buildRequestHeaders(),
      });
      expect(await sessionReaderAfterRestart.readActiveSession()).toEqual({
        userId: storedAccount.id,
        displayName: storedAccount.name,
        email: storedAccount.email,
      });

      emulatedBrowser.clear();
      await buildAuthenticator(secondInstance).signInWithPassword(
        parseSignInCredentials({ email: "ana@example.com", password: "correct horse" }),
      );
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).not.toBeNull();
      expect(emulatedBrowser.readCookieValue(SESSION_COOKIE_NAME)).not.toBe(sessionToken);
      expect(await sessionReaderAfterRestart.readActiveSession()).toEqual({
        userId: storedAccount.id,
        displayName: storedAccount.name,
        email: storedAccount.email,
      });
    });
  });

  describe("passwords are never readable (FR-32)", () => {
    const TYPED_PASSWORD = "unique-typed-password-4f9c1a";
    const WRONG_PASSWORD = "unique-wrong-password-77d2be";

    async function readEverythingStored(): Promise<string> {
      const [users, sessions, accounts, verifications] = await Promise.all([
        prismaClient.user.findMany(),
        prismaClient.session.findMany(),
        prismaClient.account.findMany(),
        prismaClient.verification.findMany(),
      ]);
      return JSON.stringify({ users, sessions, accounts, verifications });
    }

    it("stores only a salted hash in Account.password and no stored row holds the typed password", async () => {
      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com", TYPED_PASSWORD));
      await accountAuthenticator.signInWithPassword(
        parseSignInCredentials({ email: "ana@example.com", password: TYPED_PASSWORD }),
      );

      const storedAccount = await prismaClient.account.findFirstOrThrow();
      expect(storedAccount.password).toMatch(/^scrypt\$16384\$16\$1\$[0-9a-f]{32}\$[0-9a-f]{128}$/);
      expect(await readEverythingStored()).not.toContain(TYPED_PASSWORD);
    });

    it("keeps the typed password out of every log line, error and message, in success and in failure", async () => {
      const loggedLines: unknown[][] = [];
      for (const method of ["log", "info", "warn", "error", "debug"] as const) {
        vi.spyOn(console, method).mockImplementation((...lineParts: unknown[]) => {
          loggedLines.push(lineParts);
        });
      }
      const brokenAuthenticator = buildAuthenticator(
        buildBetterAuthInstance(createPrismaClient(UNREACHABLE_DATABASE_URL)),
      );
      const failures: unknown[] = [];
      const collectFailure = (work: Promise<unknown>) =>
        work.then(
          () => undefined,
          (reason: unknown) => {
            failures.push(reason);
          },
        );

      await accountAuthenticator.registerAndSignIn(signUpRequest("ana@example.com", TYPED_PASSWORD));
      emulatedBrowser.clear();
      await collectFailure(
        accountAuthenticator.registerAndSignIn(signUpRequest("ANA@example.com", TYPED_PASSWORD)),
      );
      await collectFailure(
        accountAuthenticator.signInWithPassword(
          parseSignInCredentials({ email: "ana@example.com", password: WRONG_PASSWORD }),
        ),
      );
      await collectFailure(
        accountAuthenticator.signInWithPassword(
          parseSignInCredentials({ email: "nobody@example.com", password: WRONG_PASSWORD }),
        ),
      );
      await collectFailure(
        brokenAuthenticator.registerAndSignIn(signUpRequest("lia@example.com", TYPED_PASSWORD)),
      );
      await collectFailure(
        brokenAuthenticator.signInWithPassword(
          parseSignInCredentials({ email: "ana@example.com", password: TYPED_PASSWORD }),
        ),
      );

      expect(failures).toHaveLength(5);
      const everythingSeen = inspect([loggedLines, failures], { depth: 20 });
      expect(everythingSeen).not.toContain(TYPED_PASSWORD);
      expect(everythingSeen).not.toContain(WRONG_PASSWORD);
    });
  });

  describe("when the database cannot be reached (FR-36)", () => {
    let brokenAuthenticator: AccountAuthenticator;

    beforeEach(() => {
      brokenAuthenticator = buildAuthenticator(
        buildBetterAuthInstance(createPrismaClient(UNREACHABLE_DATABASE_URL)),
      );
      vi.spyOn(console, "error").mockImplementation(() => undefined);
      vi.spyOn(console, "warn").mockImplementation(() => undefined);
    });

    async function captureFailure(work: Promise<unknown>): Promise<unknown> {
      return work.then(
        () => {
          throw new Error("Expected the operation to fail, but it succeeded.");
        },
        (reason: unknown) => reason,
      );
    }

    it("fails sign-up with an InfrastructureError with a generic message and the cause kept", async () => {
      const failure = await captureFailure(
        brokenAuthenticator.registerAndSignIn(signUpRequest("ana@example.com")),
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
      const infrastructureFailure = failure as InfrastructureError;
      expect(infrastructureFailure.message).not.toMatch(/unreachable-secret|127\.0\.0\.1|nowhere|nobody/);
      expect(infrastructureFailure.cause).toBeDefined();
    });

    it("fails sign-in with an InfrastructureError, not with the credential error", async () => {
      const failure = await captureFailure(
        brokenAuthenticator.signInWithPassword(
          parseSignInCredentials({ email: "ana@example.com", password: "correct horse" }),
        ),
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect(failure).not.toBeInstanceOf(InvalidCredentialsError);
      expect((failure as InfrastructureError).message).not.toMatch(
        /unreachable-secret|127\.0\.0\.1|nowhere|nobody/,
      );
    });
  });
});
