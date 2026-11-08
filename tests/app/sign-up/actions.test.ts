import { inspect } from "node:util";
import { describe, expect, it, vi } from "vitest";
import { signUpAction } from "@/app/sign-up/actions";
import {
  ACCOUNT_DISPLAY_NAME_FIELD,
  ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE,
  ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE,
  ACCOUNT_EMAIL_FIELD,
  ACCOUNT_EMAIL_INVALID_CODE,
  ACCOUNT_PASSWORD_FIELD,
  ACCOUNT_PASSWORD_LENGTH_CODE,
  REPEAT_PASSWORD_FIELD,
  REPEAT_PASSWORD_MISMATCH_CODE,
} from "@/modules/accounts";
import {
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
  InfrastructureError,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import { getBetterAuthInstance } from "@/shared/infrastructure/better-auth-instance";
import { getActingUser } from "@/shared/presentation/get-acting-user";
import { CROSS_SITE_REQUEST_ISSUE_CODE } from "@/shared/presentation/assert-same-site-request";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
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

const TYPED_PASSWORD = "unique-typed-password-4f9c1a";

const { readStoredRowsClient } = prepareRealCompositionOverTestDatabase();

function buildTypedSignUp(overrides: Record<string, unknown> = {}) {
  return {
    displayName: "Ana Torres",
    email: "ana@example.com",
    password: TYPED_PASSWORD,
    repeatPassword: TYPED_PASSWORD,
    ...overrides,
  };
}

async function readEverythingStored(): Promise<string> {
  const storedRowsClient = readStoredRowsClient();
  const [users, sessions, accounts, verifications] = await Promise.all([
    storedRowsClient.user.findMany(),
    storedRowsClient.session.findMany(),
    storedRowsClient.account.findMany(),
    storedRowsClient.verification.findMany(),
  ]);
  return JSON.stringify({ users, sessions, accounts, verifications });
}

function expectNothingWasCreated(): Promise<void> {
  return Promise.all([
    readStoredRowsClient().user.count(),
    readStoredRowsClient().session.count(),
  ]).then(([accountCount, sessionCount]) => {
    expect(accountCount).toBe(0);
    expect(sessionCount).toBe(0);
    expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBeNull();
  });
}

describe("signUpAction", () => {
  describe("when the person signs up with valid values (FR-1, FR-10, FR-12)", () => {
    it("answers signed-up, stores the comparable email and the trimmed name, and leaves a valid session", async () => {
      const result = await signUpAction(
        buildTypedSignUp({ displayName: "  Ana Torres  ", email: "  Ana.Maria@Example.COM " }),
      );

      expect(result).toEqual({ ok: true, value: { status: "signed-up" } });
      const storedAccount = await readStoredRowsClient().user.findUniqueOrThrow({
        where: { email: "ana.maria@example.com" },
      });
      expect(storedAccount.name).toBe("Ana Torres");
      expect(await getActingUser()).toEqual({
        userId: storedAccount.id,
        displayName: storedAccount.name,
        email: storedAccount.email,
      });
    });

    it("sets a session cookie that scripts cannot read and that is not sent from other sites (FR-27, FR-28)", async () => {
      await signUpAction(buildTypedSignUp());

      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).not.toBeNull();
      const writtenOptions = emulatedBrowser.readLastWrittenOptions(TEST_SESSION_COOKIE_NAME);
      expect(writtenOptions?.httpOnly).toBe(true);
      expect(String(writtenOptions?.sameSite).toLowerCase()).toBe("strict");
    });

    it("keeps the typed password out of the result and of every stored row (FR-32)", async () => {
      const result = await signUpAction(buildTypedSignUp());

      expect(JSON.stringify(result)).not.toContain(TYPED_PASSWORD);
      expect(await readEverythingStored()).not.toContain(TYPED_PASSWORD);
    });

    it("accepts a request from a page of the application itself", async () => {
      emulateRequestFromThisSite();

      const result = await signUpAction(buildTypedSignUp());

      expect(result).toEqual({ ok: true, value: { status: "signed-up" } });
    });

    it("accepts a display name of exactly 120 characters (FR-2, FR-3)", async () => {
      const result = await signUpAction(buildTypedSignUp({ displayName: "a".repeat(120) }));

      expect(result).toEqual({ ok: true, value: { status: "signed-up" } });
    });

    it.each(["ana.maria@example.co.uk", "x+y@example.co", "o'brien@example.com"])(
      "accepts the valid email %s (FR-5)",
      async (validEmail) => {
        const result = await signUpAction(buildTypedSignUp({ email: validEmail }));

        expect(result).toEqual({ ok: true, value: { status: "signed-up" } });
        expect(await readStoredRowsClient().user.count({ where: { email: validEmail } })).toBe(1);
      },
    );
  });

  describe("when a value is not valid (FR-2 to FR-7, FR-34)", () => {
    it("reports a display name of 121 characters on that field and creates nothing", async () => {
      const result = await signUpAction(buildTypedSignUp({ displayName: "a".repeat(121) }));

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          fieldErrors: { [ACCOUNT_DISPLAY_NAME_FIELD]: [{ code: ACCOUNT_DISPLAY_NAME_TOO_LONG_CODE }] },
        },
      });
      await expectNothingWasCreated();
    });

    it("reports a display name with a line break on that field and creates nothing", async () => {
      const result = await signUpAction(buildTypedSignUp({ displayName: "Ana\nTorres" }));

      expect(result).toMatchObject({
        ok: false,
        error: {
          fieldErrors: {
            [ACCOUNT_DISPLAY_NAME_FIELD]: [{ code: ACCOUNT_DISPLAY_NAME_INVALID_CHARACTERS_CODE }],
          },
        },
      });
      await expectNothingWasCreated();
    });

    it("reports a repeat password that differs on the repeat field and creates nothing", async () => {
      const result = await signUpAction(buildTypedSignUp({ repeatPassword: "something else" }));

      expect(result).toMatchObject({
        ok: false,
        error: { fieldErrors: { [REPEAT_PASSWORD_FIELD]: [{ code: REPEAT_PASSWORD_MISMATCH_CODE }] } },
      });
      await expectNothingWasCreated();
    });

    it.each(["añ@example.com", "a b@example.com", "a@@example.com", "Kana@example.com", ""])(
      "reports the email %j on the email field and creates nothing",
      async (invalidEmail) => {
        const result = await signUpAction(buildTypedSignUp({ email: invalidEmail }));

        expect(result).toMatchObject({
          ok: false,
          error: { fieldErrors: { [ACCOUNT_EMAIL_FIELD]: [{ code: ACCOUNT_EMAIL_INVALID_CODE }] } },
        });
        await expectNothingWasCreated();
      },
    );

    it("reports every failing field together, with both limits on the password", async () => {
      const result = await signUpAction({
        displayName: "",
        email: "not an email",
        password: "short",
        repeatPassword: "other",
      });

      expect(result.ok).toBe(false);
      if (result.ok) return;
      expect(result.error.code).toBe(VALIDATION_ERROR_CODE);
      expect(Object.keys(result.error.fieldErrors ?? {}).sort()).toEqual(
        [ACCOUNT_DISPLAY_NAME_FIELD, ACCOUNT_EMAIL_FIELD, ACCOUNT_PASSWORD_FIELD, REPEAT_PASSWORD_FIELD].sort(),
      );
      expect(result.error.fieldErrors?.[ACCOUNT_PASSWORD_FIELD]).toEqual([
        { code: ACCOUNT_PASSWORD_LENGTH_CODE, minimumLength: 8, maximumLength: 128 },
      ]);
      await expectNothingWasCreated();
    });
  });

  describe("when the input has the wrong shape (FR-21, NFR-1)", () => {
    it("rejects an unknown key such as a userId and creates nothing", async () => {
      const result = await signUpAction(buildTypedSignUp({ userId: "someone-else" }));

      expect(result).toMatchObject({
        ok: false,
        error: {
          code: VALIDATION_ERROR_CODE,
          fieldErrors: { userId: [{ code: INVALID_INPUT_ISSUE_CODE }] },
        },
      });
      await expectNothingWasCreated();
    });

    it.each([
      ["a value that is not a string", buildTypedSignUp({ displayName: 42 })],
      ["a missing field", { displayName: "Ana", email: "ana@example.com", password: TYPED_PASSWORD }],
      ["null", null],
      ["a string", "ana@example.com"],
    ])("rejects %s and creates nothing", async (_label, input) => {
      const result = await signUpAction(input);

      expect(result).toMatchObject({ ok: false, error: { code: VALIDATION_ERROR_CODE } });
      await expectNothingWasCreated();
    });
  });

  describe("when the email is already registered (FR-9)", () => {
    it("answers a business rule violation for the same email in other case and with spaces, and keeps one account", async () => {
      await signUpAction(buildTypedSignUp());
      emulatedBrowser.clear();

      const result = await signUpAction(buildTypedSignUp({ email: "  ANA@Example.com " }));

      expect(result).toEqual({
        ok: false,
        error: {
          code: BUSINESS_RULE_VIOLATION_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[BUSINESS_RULE_VIOLATION_ERROR_CODE],
        },
      });
      expect(await readStoredRowsClient().user.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBeNull();
      expect(JSON.stringify(result)).not.toContain(TYPED_PASSWORD);
    });
  });

  describe("when the request comes from another site (FR-30)", () => {
    it.each(CROSS_SITE_REQUEST_EMULATIONS)(
      "rejects a request with $label, creates no account and starts no session",
      async ({ emulate }) => {
        emulate();

        const result = await signUpAction(buildTypedSignUp());

        expect(result).toMatchObject({
          ok: false,
          error: {
            code: VALIDATION_ERROR_CODE,
            fieldErrors: { request: [{ code: CROSS_SITE_REQUEST_ISSUE_CODE }] },
          },
        });
        await expectNothingWasCreated();
      },
    );
  });

  describe("when the person is already signed in (FR-19)", () => {
    it("processes nothing, keeps the session and answers already-signed-in", async () => {
      await signUpAction(buildTypedSignUp());
      const sessionTokenBefore = emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME);

      const result = await signUpAction(buildTypedSignUp({ email: "lia@example.com" }));

      expect(result).toEqual({ ok: true, value: { status: "already-signed-in" } });
      expect(await readStoredRowsClient().user.count()).toBe(1);
      expect(await readStoredRowsClient().session.count()).toBe(1);
      expect(emulatedBrowser.readCookieValue(TEST_SESSION_COOKIE_NAME)).toBe(sessionTokenBefore);
    });

    it("validates nothing: an invalid submission also answers already-signed-in", async () => {
      await signUpAction(buildTypedSignUp());

      const result = await signUpAction(buildTypedSignUp({ email: "not an email" }));

      expect(result).toEqual({ ok: true, value: { status: "already-signed-in" } });
    });
  });

  describe("when the account engine fails (FR-32, FR-36)", () => {
    it("answers the generic infrastructure result, echoes nothing and logs the cause", async () => {
      const internalFailure = new Error("connection to db-host-7 refused, query: insert into user");
      vi.spyOn(getBetterAuthInstance().api, "signUpEmail").mockRejectedValue(internalFailure);
      const loggedLines: unknown[][] = [];
      vi.spyOn(console, "error").mockImplementation((...lineParts: unknown[]) => {
        loggedLines.push(lineParts);
      });

      const result = await signUpAction(buildTypedSignUp());

      expect(result).toEqual({
        ok: false,
        error: {
          code: INFRASTRUCTURE_ERROR_CODE,
          message: ERROR_MESSAGE_BY_CODE[INFRASTRUCTURE_ERROR_CODE],
        },
      });
      const returnedText = JSON.stringify(result);
      expect(returnedText).not.toContain(TYPED_PASSWORD);
      expect(returnedText).not.toMatch(/db-host-7|insert into|stack/i);

      const loggedInfrastructureError = loggedLines
        .flat()
        .find((logged): logged is InfrastructureError => logged instanceof InfrastructureError);
      expect(loggedInfrastructureError?.cause).toBe(internalFailure);
      expect(inspect(loggedLines, { depth: 20 })).not.toContain(TYPED_PASSWORD);
      await expectNothingWasCreated();
    });
  });
});
