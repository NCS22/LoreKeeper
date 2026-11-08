import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { signInAction } from "@/app/sign-in/actions";
import {
  ACCOUNT_EMAIL_FIELD,
  createAccountsModule,
  SIGN_IN_EMAIL_REQUIRED_CODE,
  SIGN_IN_PASSWORD_REQUIRED_CODE,
} from "@/modules/accounts";
import {
  AUTHENTICATION_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
  InfrastructureError,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { CROSS_SITE_REQUEST_ISSUE_CODE } from "@/shared/presentation/assert-same-site-request";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import { INVALID_INPUT_ISSUE_CODE } from "@/shared/presentation/parse-action-input";
import {
  CROSS_SITE_REQUEST_EMULATIONS,
  TEST_SESSION_COOKIE_NAME,
  emulateRequestFromThisSite,
  prepareRealCompositionOverTestDatabase,
} from "../../support/database/real-composition-environment";
import { emulatedBrowser } from "../../support/emulated-next-headers";

vi.mock("next/headers", async () =>
  (await import("../../support/emulated-next-headers")).nextHeadersModuleReplacement,
);

const REGISTERED_EMAIL = "ana@example.com";
const REGISTERED_PASSWORD = "unique-typed-password-4f9c1a";
const WRONG_PASSWORD = "unique-wrong-password-77d2be";

const { readStoredRowsClient } = prepareRealCompositionOverTestDatabase();

/**
 * Registers an account through the use case, then removes the session that signing up started,
 * so the test begins with an account, no stored session and a browser that holds none.
 */
async function registerAccountAndForgetItsSession(
  email = REGISTERED_EMAIL,
  password = REGISTERED_PASSWORD,
): Promise<void> {
  await createAccountsModule().signUp({
    displayName: "Ana Torres",
    email,
    password,
    repeatPassword: password,
  });
  emulatedBrowser.clear();
  await readStoredRowsClient().session.deleteMany();
}

function expectNoSessionWasStarted(): Promise<void> {
  return readStoredRowsClient()
    .session.count()
    .then((sessionCount) => {
      expect(sessionCount).toBe(0);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBeNull();
    });
}

describe("signInAction", () => {
  describe("with the right email and password (FR-13)", () => {
    it("answers signed-in and leaves a valid session for that account", async () => {
      await registerAccountAndForgetItsSession();

      const result = await signInAction({ email: REGISTERED_EMAIL, password: REGISTERED_PASSWORD });

      expect(result).toEqual({ ok: true, value: { status: "signed-in" } });
      const storedAccount = await readStoredRowsClient().user.findUniqueOrThrow({
        where: { email: REGISTERED_EMAIL },
      });
      expect(await getActingUser()).toEqual({
        userId: storedAccount.id,
        displayName: storedAccount.name,
        email: storedAccount.email,
      });
    });

    it("signs in with the email typed in other case and with spaces", async () => {
      await registerAccountAndForgetItsSession();

      const result = await signInAction({
        email: "  ANA@Example.com ",
        password: REGISTERED_PASSWORD,
      });

      expect(result).toEqual({ ok: true, value: { status: "signed-in" } });
    });

    it("sets a session cookie that scripts cannot read and that is not sent from other sites (FR-27, FR-28)", async () => {
      await registerAccountAndForgetItsSession();

      await signInAction({ email: REGISTERED_EMAIL, password: REGISTERED_PASSWORD });

      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).not.toBeNull();
      const writtenOptions = emulatedBrowser.readLastWrittenOptions(TEST_SESSION_COOKIE_NAME);
      expect(writtenOptions?.httpOnly).toBe(true);
      expect(String(writtenOptions?.sameSite).toLowerCase()).toBe("strict");
    });

    it("accepts a request from a page of the application itself", async () => {
      await registerAccountAndForgetItsSession();
      emulateRequestFromThisSite();

      const result = await signInAction({ email: REGISTERED_EMAIL, password: REGISTERED_PASSWORD });

      expect(result).toEqual({ ok: true, value: { status: "signed-in" } });
    });
  });

  describe("with credentials that do not match (FR-14, FR-35)", () => {
    it("gives the very same result for a wrong password and for an unknown email, with no session", async () => {
      await registerAccountAndForgetItsSession();

      const wrongPasswordResult = await signInAction({
        email: REGISTERED_EMAIL,
        password: WRONG_PASSWORD,
      });
      const unknownEmailResult = await signInAction({
        email: "nobody@example.com",
        password: WRONG_PASSWORD,
      });

      const expectedResult = {
        ok: false,
        error: {
          code: AUTHENTICATION_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[AUTHENTICATION_ERROR_CODE],
        },
      };
      expect(wrongPasswordResult).toEqual(expectedResult);
      expect(unknownEmailResult).toEqual(expectedResult);
      expect(JSON.stringify([wrongPasswordResult, unknownEmailResult])).not.toContain(WRONG_PASSWORD);
      await expectNoSessionWasStarted();
    });

    it.each([
      ["a malformed email", "not an email", REGISTERED_PASSWORD],
      ["a 3-character password", REGISTERED_EMAIL, "abc"],
      ["a password far longer than the sign-up limit", REGISTERED_EMAIL, "x".repeat(5000)],
    ])("answers %s with the credential answer, not with a validation issue (FR-15)", async (_label, email, password) => {
      await registerAccountAndForgetItsSession();

      const result = await signInAction({ email, password });

      expect(result).toMatchObject({ ok: false, error: { code: AUTHENTICATION_ERROR_CODE } });
      expect(result).not.toHaveProperty("error.fieldErrors");
      await expectNoSessionWasStarted();
    });
  });

  describe("with an empty email or an empty password (FR-15)", () => {
    it.each([
      ["email", { email: "   ", password: REGISTERED_PASSWORD }, "email", SIGN_IN_EMAIL_REQUIRED_CODE],
      ["password", { email: REGISTERED_EMAIL, password: "" }, "password", SIGN_IN_PASSWORD_REQUIRED_CODE],
    ])("reports the empty %s on its own field and starts no session", async (_label, input, field, code) => {
      await registerAccountAndForgetItsSession();

      const result = await signInAction(input);

      expect(result).toEqual({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[VALIDATION_ERROR_CODE],
          fieldErrors: { [field]: [{ code }] },
        },
      });
      await expectNoSessionWasStarted();
    });

    it("reports both fields when both are empty", async () => {
      const result = await signInAction({ email: "", password: "" });

      expect(result).toMatchObject({
        ok: false,
        error: {
          fieldErrors: {
            [ACCOUNT_EMAIL_FIELD]: [{ code: SIGN_IN_EMAIL_REQUIRED_CODE }],
            password: [{ code: SIGN_IN_PASSWORD_REQUIRED_CODE }],
          },
        },
      });
    });
  });

  describe("when the input has the wrong shape (FR-21, NFR-1)", () => {
    it("rejects an unknown key such as a userId and starts no session", async () => {
      await registerAccountAndForgetItsSession();

      const result = await signInAction({
        email: REGISTERED_EMAIL,
        password: REGISTERED_PASSWORD,
        userId: "someone-else",
      });

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          fieldErrors: { userId: [{ code: INVALID_INPUT_ISSUE_CODE }] },
        },
      });
      await expectNoSessionWasStarted();
    });

    it.each([
      ["a value that is not a string", { email: REGISTERED_EMAIL, password: 12345678 }],
      ["a missing field", { email: REGISTERED_EMAIL }],
      ["null", null],
    ])("rejects %s and starts no session", async (_label, input) => {
      const result = await signInAction(input);

      expect(result).toMatchObject({ ok: false, error: { code: VALIDATION_ERROR_CODE } });
      await expectNoSessionWasStarted();
    });
  });

  describe("when the request comes from another site (FR-30)", () => {
    it.each(CROSS_SITE_REQUEST_EMULATIONS)(
      "rejects a request with $label, even with the right credentials, and starts no session",
      async ({ emulate }) => {
        await registerAccountAndForgetItsSession();
        emulate();

        const result = await signInAction({
          email: REGISTERED_EMAIL,
          password: REGISTERED_PASSWORD,
        });

        expect(result).toMatchObject({
          ok: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
          },
        });
        await expectNoSessionWasStarted();
      },
    );
  });

  describe("when the person is already signed in (FR-19)", () => {
    it("processes nothing, keeps the session and answers already-signed-in, even for other credentials", async () => {
      await registerAccountAndForgetItsSession();
      await registerAccountAndForgetItsSession("lia@example.com");
      await signInAction({ email: REGISTERED_EMAIL, password: REGISTERED_PASSWORD });
      const sessionTokenBefore = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);
      const storedAccount = await readStoredRowsClient().user.findUniqueOrThrow({
        where: { email: REGISTERED_EMAIL },
      });

      const result = await signInAction({
        email: "lia@example.com",
        password: REGISTERED_PASSWORD,
      });

      expect(result).toEqual({ ok: true, value: { status: "already-signed-in" } });
      expect(await readStoredRowsClient().session.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBe(sessionTokenBefore);
      expect(await getActingUser()).toEqual({
        userId: storedAccount.id,
        displayName: storedAccount.name,
        email: storedAccount.email,
      });
    });
  });

  describe("when the account engine fails (FR-32, FR-36)", () => {
    it("answers the generic infrastructure result, echoes nothing and logs the cause", async () => {
      await registerAccountAndForgetItsSession();
      const internalFailure = new Error("connection to db-host-7 refused, query: select from user");
      vi.spyOn(getBetterAuthInstance().api, "signInEmail").mockRejectedValue(internalFailure);
      const loggedLines: unknown[][] = [];
      vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
        loggedLines.push(lineParts);
      });

      const result = await signInAction({ email: REGISTERED_EMAIL, password: REGISTERED_PASSWORD });

      expect(result).toEqual({
        ok: false,
        error: {
          code: INFRASTRUCTURE_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
        },
      });
      const returnedText = JSON.stringify(result);
      expect(returnedText).not.toContain(REGISTERED_PASSWORD);
      expect(returnedText).not.toMatch(/db-host-7|select from|stack/i);

      const loggedInfrastructureError = loggedLines
        .flat()
        .find((logged): logged is InfrastructureError => logged instanceof InfrastructureError);
      expect(loggedInfrastructureError?.cause).toBe(internalFailure);
      expect(inspect(loggedLines, { depth: 20 })).not.toContain(REGISTERED_PASSWORD);
      await expectNoSessionWasStarted();
    });
  });
});
