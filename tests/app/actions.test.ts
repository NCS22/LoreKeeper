import { describe, expect, it, vi } from "vitest";
import { signOutAction } from "@/app/actions";
import { signInAction } from "@/app/sign-in/actions";
import { signUpAction } from "@/app/sign-up/actions";
import { createAccountsModule } from "@/modules/accounts";
import {
  AuthenticationError,
  INFRASTRUCTURE_ERROR_CODE,
  InfrastructureError,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { CROSS_SITE_REQUEST_ISSUE_CODE } from "@/shared/presentation/assert-same-site-request";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import {
  CROSS_SITE_REQUEST_EMULATIONS,
  TEST_SESSION_COOKIE_NAME,
  emulateRequestFromThisSite,
  prepareRealCompositionOverTestDatabase,
} from "../support/database/real-composition-environment";
import { emulatedBrowser } from "../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const EMAIL = "ana@example.com";
const PASSWORD = "unique-typed-password-4f9c1a";

const { readStoredRowsClient } = prepareRealCompositionOverTestDatabase();

async function signUpAnaThroughTheUseCase(): Promise<void> {
  await createAccountsModule().signUp({
    displayName: "Ana Torres",
    email: EMAIL,
    password: PASSWORD,
    repeatPassword: PASSWORD,
  });
}

/** Whether the session the browser holds is accepted: the acting-user check is what every later feature uses. */
async function theBrowserIsSignedIn(): Promise<boolean> {
  return getActingUser().then(
    () => true,
    (failure: unknown) => {
      if (failure instanceof AuthenticationError) return false;
      throw failure;
    },
  );
}

describe("signOutAction", () => {
  describe("with a valid session (FR-16, FR-17)", () => {
    it("succeeds with null, ends the session and clears the cookie", async () => {
      await signUpAnaThroughTheUseCase();
      expect(await theBrowserIsSignedIn()).toBe(true);

      const result = await signOutAction();

      expect(result).toEqual({ ok: true, value: null });
      expect(await readStoredRowsClient().session.count()).toBe(0);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBeNull();
      expect(await theBrowserIsSignedIn()).toBe(false);
    });

    it("rejects the old session when it is presented again", async () => {
      await signUpAnaThroughTheUseCase();
      const oldSessionToken = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
      expect(oldSessionToken).not.toBeNull();

      await signOutAction();
      emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, oldSessionToken ?? "");

      expect(await theBrowserIsSignedIn()).toBe(false);
    });

    it("ends only the session of the device in use and leaves the other devices signed in", async () => {
      await signUpAnaThroughTheUseCase();
      const sessionTokenOfFirstDevice = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
      emulatedBrowser.clear();
      await signInAction({ email: EMAIL, password: PASSWORD });
      expect(await readStoredRowsClient().session.count()).toBe(2);

      await signOutAction();

      expect(await readStoredRowsClient().session.count()).toBe(1);
      expect(await theBrowserIsSignedIn()).toBe(false);
      emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, sessionTokenOfFirstDevice ?? "");
      expect(await theBrowserIsSignedIn()).toBe(true);
    });

    it("accepts a request from a page of the application itself", async () => {
      await signUpAnaThroughTheUseCase();
      emulateRequestFromThisSite();

      expect(await signOutAction()).toEqual({ ok: true, value: null });
      expect(await readStoredRowsClient().session.count()).toBe(0);
    });
  });

  describe("without a valid session (FR-18)", () => {
    it("succeeds when the person never signed in", async () => {
      expect(await signOutAction()).toEqual({ ok: true, value: null });
    });

    it("succeeds a second time", async () => {
      await signUpAnaThroughTheUseCase();

      expect(await signOutAction()).toEqual({ ok: true, value: null });
      expect(await signOutAction()).toEqual({ ok: true, value: null });
    });

    it("succeeds when the session was already deleted on the server", async () => {
      await signUpAnaThroughTheUseCase();
      await readStoredRowsClient().session.deleteMany();

      expect(await signOutAction()).toEqual({ ok: true, value: null });
    });
  });

  describe("when the request comes from another site (FR-30)", () => {
    it.each(CROSS_SITE_REQUEST_EMULATIONS)(
      "rejects a request with $label and leaves the session in use",
      async ({ emulate }) => {
        await signUpAnaThroughTheUseCase();
        const sessionTokenBefore = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
        emulate();

        const result = await signOutAction();

        expect(result).toMatchObject({
          ok: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
          },
        });
        expect(await readStoredRowsClient().session.count()).toBe(1);
        expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBe(sessionTokenBefore);
        expect(await theBrowserIsSignedIn()).toBe(true);
      },
    );
  });

  describe("when the account engine fails (FR-36)", () => {
    it("answers the generic infrastructure result and logs the cause", async () => {
      await signUpAnaThroughTheUseCase();
      const internalFailure = new Error("connection to db-host-7 refused");
      vi.spyOn(getBetterAuthInstance().api, "signOut").mockRejectedValue(internalFailure);
      const loggedLines: unknown[][] = [];
      vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
        loggedLines.push(lineParts);
      });

      const result = await signOutAction();

      expect(result).toEqual({
        ok: false,
        error: {
          code: INFRASTRUCTURE_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/db-host-7|stack/i);
      const loggedInfrastructureError = loggedLines
        .flat()
        .find((logged): logged is InfrastructureError => logged instanceof InfrastructureError);
      expect(loggedInfrastructureError?.cause).toBe(internalFailure);
    });

    it("answers the generic infrastructure result, logs only the cause and keeps the session and the cookie when deleting the session row fails (FR-16, FR-36)", async () => {
      await signUpAnaThroughTheUseCase();
      const sessionTokenBefore = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
      expect(sessionTokenBefore).not.toBeNull();
      const { internalAdapter } = await getBetterAuthInstance().$context;
      const internalFailure = new Error("connection to db-host-7 refused");
      vi.spyOn(internalAdapter, "deleteSession").mockRejectedValue(internalFailure);
      const loggedLines: unknown[][] = [];
      vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
        loggedLines.push(lineParts);
      });

      const result = await signOutAction();

      expect(result).toEqual({
        ok: false,
        error: {
          code: INFRASTRUCTURE_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
        },
      });
      expect(JSON.stringify(result)).not.toMatch(/db-host-7|stack/i);
      const loggedInfrastructureError = loggedLines
        .flat()
        .find((logged): logged is InfrastructureError => logged instanceof InfrastructureError);
      expect(loggedInfrastructureError?.cause).toBe(internalFailure);
      expect(await readStoredRowsClient().session.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBe(sessionTokenBefore);
    });
  });
});

describe("the three actions together", () => {
  it("sign up, sign out (the old session is rejected) and sign in again with the same email and password", async () => {
    const signUpResult = await signUpAction({
      displayName: "Ana Torres",
      email: EMAIL,
      password: PASSWORD,
      repeatPassword: PASSWORD,
    });
    expect(signUpResult).toEqual({ ok: true, value: { status: "signed-up" } });
    const storedAccount = await readStoredRowsClient().user.findUniqueOrThrow({
      where: { email: EMAIL },
    });
    expect(await getActingUser()).toEqual({
      userId: storedAccount.id,
      displayName: storedAccount.name,
      email: storedAccount.email,
    });
    const oldSessionToken = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);

    expect(await signOutAction()).toEqual({ ok: true, value: null });
    expect(await theBrowserIsSignedIn()).toBe(false);
    emulatedBrowser.holdCookie(TEST_SESSION_COOKIE_NAME, oldSessionToken ?? "");
    expect(await theBrowserIsSignedIn()).toBe(false);
    emulatedBrowser.clear();

    const signInResult = await signInAction({ email: EMAIL, password: PASSWORD });
    expect(signInResult).toEqual({ ok: true, value: { status: "signed-in" } });
    expect(await getActingUser()).toEqual({
      userId: storedAccount.id,
      displayName: storedAccount.name,
      email: storedAccount.email,
    });
    expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).not.toBe(oldSessionToken);
  });
});
