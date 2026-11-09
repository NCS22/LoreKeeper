import { describe, expect, it } from "vitest";
import { buildAccountFormVocabulary } from "@/components/accounts/build-account-form-vocabulary";
import {
  interpretAccountActionResult,
  type AccountOperation,
} from "@/components/accounts/interpret-account-action-result";
import type { TimeLimitedOutcome } from "@/components/accounts/run-with-time-limit";
import { en } from "@/messages/en";
import {
  AUTHENTICATION_ERROR_CODE,
  BUSINESS_RULE_VIOLATION_ERROR_CODE,
  EXTERNAL_PROVIDER_ERROR_CODE,
  INFRASTRUCTURE_ERROR_CODE,
  NOT_FOUND_ERROR_CODE,
} from "@/shared/domain/error-kinds";
import { VALIDATION_ERROR_CODE } from "@/shared/domain/validation-error";
import {
  SESSION_CHECK_FAILED_ACTION_REFUSAL,
  SIGNED_OUT_ACTION_REFUSAL,
} from "@/shared/presentation/signed-out-action-response";

const vocabulary = buildAccountFormVocabulary();
const { issueCodes, fieldNames } = vocabulary;

const GENERAL_FAILURE = { status: "message", message: en.accountForms.generalFailure };

function answered(value: unknown): TimeLimitedOutcome<unknown> {
  return { status: "answered", value };
}

function failure(code: string, extra: Record<string, unknown> = {}): TimeLimitedOutcome<unknown> {
  return answered({ ok: false, error: { code, message: "ignored by the interface", ...extra } });
}

function interpret(operation: AccountOperation, outcome: TimeLimitedOutcome<unknown>) {
  return interpretAccountActionResult(operation, outcome, vocabulary);
}

describe("interpretAccountActionResult", () => {
  describe("successes", () => {
    it.each([
      ["sign-up", { status: "signed-up" }],
      ["sign-in", { status: "signed-in" }],
    ] as const)("reads a %s success as succeeded", (operation, value) => {
      expect(interpret(operation, answered({ ok: true, value }))).toEqual({ status: "succeeded" });
    });

    it.each(["sign-up", "sign-in"] as const)(
      "reads already-signed-in of a %s as its own outcome (FR-22)",
      (operation) => {
        expect(
          interpret(operation, answered({ ok: true, value: { status: "already-signed-in" } })),
        ).toEqual({ status: "already-signed-in" });
      },
    );

    it("reads a sign-out success as succeeded", () => {
      expect(interpret("sign-out", answered({ ok: true, value: null }))).toEqual({ status: "succeeded" });
    });

    it.each([
      ["a sign-in success shown to a sign-up form", "sign-up", { status: "signed-in" }],
      ["a sign-up success shown to a sign-in form", "sign-in", { status: "signed-up" }],
      ["an unknown status", "sign-in", { status: "something-else" }],
      ["a success with no value", "sign-up", undefined],
      ["a success with a null value", "sign-in", null],
    ] as const)("reads %s as the general failure", (_label, operation, value) => {
      expect(interpret(operation, answered({ ok: true, value }))).toEqual(GENERAL_FAILURE);
    });

    it.each([
      ["a sign-out success with a value", { status: "signed-in" }],
      ["a sign-out already-signed-in", { status: "already-signed-in" }],
    ])("reads %s as the general failure (not applicable to a sign-out)", (_label, value) => {
      expect(interpret("sign-out", answered({ ok: true, value }))).toEqual(GENERAL_FAILURE);
    });
  });

  describe("validation failures", () => {
    it("shows the message of each issue on its field in a sign-up (FR-4)", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: {
          [fieldNames.displayName]: [{ code: issueCodes.displayNameRequired }],
          [fieldNames.email]: [{ code: issueCodes.emailInvalid }],
          [fieldNames.password]: [{ code: issueCodes.passwordLengthOutOfRange, minimumLength: 8, maximumLength: 128 }],
          [fieldNames.repeatPassword]: [{ code: issueCodes.repeatPasswordMismatch }],
        },
      });

      expect(interpret("sign-up", outcome)).toEqual({
        status: "field-errors",
        messagesByField: {
          displayName: [en.accountForms.issues.displayNameRequired],
          email: [en.accountForms.issues.emailInvalid],
          password: [en.accountForms.issues.passwordLength(8, 128)],
          repeatPassword: [en.accountForms.issues.repeatPasswordMismatch],
        },
      });
    });

    it("shows all the messages of a field that has several issues, with the limit of the issue", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: {
          [fieldNames.displayName]: [
            { code: issueCodes.displayNameTooLong, maximumLength: 120 },
            { code: issueCodes.displayNameInvalidCharacters },
          ],
        },
      });

      expect(interpret("sign-up", outcome)).toEqual({
        status: "field-errors",
        messagesByField: {
          displayName: [
            en.accountForms.issues.displayNameTooLong(120),
            en.accountForms.issues.displayNameInvalidCharacters,
          ],
        },
      });
    });

    it("shows a message on each empty field in a sign-in (FR-6)", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: {
          [fieldNames.email]: [{ code: issueCodes.emailRequired }],
          [fieldNames.password]: [{ code: issueCodes.passwordRequired }],
        },
      });

      expect(interpret("sign-in", outcome)).toEqual({
        status: "field-errors",
        messagesByField: {
          email: [en.accountForms.issues.emailRequired],
          password: [en.accountForms.issues.passwordRequired],
        },
      });
    });

    it("shows the plain not-valid message for a code it does not know on a field of the form", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: { [fieldNames.email]: [{ code: "A_CODE_FROM_THE_FUTURE" }] },
      });

      expect(interpret("sign-up", outcome)).toEqual({
        status: "field-errors",
        messagesByField: { email: [en.accountForms.issues.unknown] },
      });
    });

    it("shows only the fields of the sign-in form in a sign-in", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: {
          [fieldNames.displayName]: [{ code: issueCodes.displayNameRequired }],
          [fieldNames.email]: [{ code: issueCodes.emailRequired }],
        },
      });

      expect(interpret("sign-in", outcome)).toEqual({
        status: "field-errors",
        messagesByField: { email: [en.accountForms.issues.emailRequired] },
      });
    });

    it.each([
      ["a request from another site", { request: [{ code: "CROSS_SITE_REQUEST" }] }],
      ["an unexpected key of the input", { userId: [{ code: "INVALID_INPUT" }] }],
      ["an input that is not an object", { input: [{ code: "INVALID_INPUT" }] }],
      ["a field with an empty list", { [fieldNames.email]: [] }],
      ["a field whose issues are malformed", { [fieldNames.email]: [{ nonsense: true }, "text", null] }],
      ["field errors that are not an object", "oops"],
      ["no field errors at all", undefined],
    ])("reads %s as the general failure (FR-9)", (_label, fieldErrors) => {
      expect(interpret("sign-up", failure(VALIDATION_ERROR_CODE, { fieldErrors }))).toEqual(GENERAL_FAILURE);
      expect(interpret("sign-in", failure(VALIDATION_ERROR_CODE, { fieldErrors }))).toEqual(GENERAL_FAILURE);
    });

    describe("field names that are special object keys, sent by the server", () => {
      // JSON.parse creates `__proto__` as an own key, the way an answer built from text would carry it.
      const FIELD_ERRORS_WITH_SPECIAL_KEYS = `{
        "__proto__": [{ "code": "EMAIL_INVALID", "polluted": true }],
        "constructor": [{ "code": "EMAIL_INVALID" }],
        "toString": [{ "code": "EMAIL_INVALID" }]
      }`;

      it.each(["sign-up", "sign-in"] as const)(
        "reads them as no field of the %s form and as the general failure, changing nothing",
        (operation) => {
          const fieldErrors: unknown = JSON.parse(FIELD_ERRORS_WITH_SPECIAL_KEYS);

          const outcome = interpret(operation, failure(VALIDATION_ERROR_CODE, { fieldErrors }));

          expect(outcome).toEqual(GENERAL_FAILURE);
          expect(Object.getPrototypeOf({})).toBe(Object.prototype);
          expect(Object.hasOwn(Object.prototype, "polluted")).toBe(false);
          expect(Object.hasOwn(Object.prototype, "code")).toBe(false);
        },
      );

      it("shows only the messages of the real fields when they come together with the special keys", () => {
        const fieldErrors: unknown = JSON.parse(
          `{ "__proto__": [{ "code": "EMAIL_INVALID" }], "constructor": [], "${fieldNames.email}": [{ "code": "${issueCodes.emailRequired}" }] }`,
        );

        const outcome = interpret("sign-in", failure(VALIDATION_ERROR_CODE, { fieldErrors }));

        expect(outcome).toEqual({
          status: "field-errors",
          messagesByField: { email: [en.accountForms.issues.emailRequired] },
        });
      });
    });

    it("reads a validation failure of a sign-out as the general failure", () => {
      const outcome = failure(VALIDATION_ERROR_CODE, {
        fieldErrors: { [fieldNames.email]: [{ code: issueCodes.emailInvalid }] },
      });

      expect(interpret("sign-out", outcome)).toEqual(GENERAL_FAILURE);
    });
  });

  describe("business rule and authentication failures", () => {
    it("shows 'already exists' on the email field of a sign-up (FR-5)", () => {
      expect(interpret("sign-up", failure(BUSINESS_RULE_VIOLATION_ERROR_CODE))).toEqual({
        status: "field-errors",
        messagesByField: { email: [en.accountForms.emailAlreadyRegistered] },
      });
    });

    it.each(["sign-in", "sign-out"] as const)(
      "reads a business rule violation of a %s as the general failure",
      (operation) => {
        expect(interpret(operation, failure(BUSINESS_RULE_VIOLATION_ERROR_CODE))).toEqual(GENERAL_FAILURE);
      },
    );

    it("shows the one credentials message for an authentication error of a sign-in (FR-7)", () => {
      expect(interpret("sign-in", failure(AUTHENTICATION_ERROR_CODE))).toEqual({
        status: "message",
        message: en.accountForms.signIn.credentialsIncorrect,
      });
    });

    it.each(["sign-up", "sign-out"] as const)(
      "reads an authentication error of a %s as the general failure",
      (operation) => {
        expect(interpret(operation, failure(AUTHENTICATION_ERROR_CODE))).toEqual(GENERAL_FAILURE);
      },
    );
  });

  describe("every other failure and every malformed answer", () => {
    const OPERATIONS = ["sign-up", "sign-in", "sign-out"] as const;

    it.each([
      INFRASTRUCTURE_ERROR_CODE,
      EXTERNAL_PROVIDER_ERROR_CODE,
      NOT_FOUND_ERROR_CODE,
      "UNKNOWN_ERROR",
      "A_CODE_FROM_THE_FUTURE",
    ])("reads the code %s as the general failure (FR-9)", (code) => {
      for (const operation of OPERATIONS) {
        expect(interpret(operation, failure(code))).toEqual(GENERAL_FAILURE);
      }
    });

    it.each([
      ["undefined", undefined],
      ["null", null],
      ["a string", "ok"],
      ["a number", 200],
      ["an array", []],
      ["an object with no ok", {}],
      ["an object with ok of the wrong type", { ok: "yes" }],
      ["a failure with no error", { ok: false }],
      ["a failure whose error is a string", { ok: false, error: "boom" }],
      ["a failure with no code", { ok: false, error: { message: "boom" } }],
      ["a failure with a numeric code", { ok: false, error: { code: 500 } }],
    ])("reads %s as the general failure and does not throw", (_label, malformedAnswer) => {
      for (const operation of OPERATIONS) {
        expect(interpret(operation, answered(malformedAnswer))).toEqual(GENERAL_FAILURE);
      }
    });

    it("never repeats the message the server sent", () => {
      const outcome = failure(INFRASTRUCTURE_ERROR_CODE, { message: "connection to db-host-7 refused" });

      expect(JSON.stringify(interpret("sign-in", outcome))).not.toContain("db-host-7");
    });
  });

  describe("no usable answer (FR-10, FR-28)", () => {
    it.each([
      ["sign-up", en.accountForms.signUp.resultUnknown],
      ["sign-in", en.accountForms.signIn.resultUnknown],
      ["sign-out", en.accountForms.signOut.resultUnknown],
    ] as const)("tells the person the result of a %s is unknown after 30 seconds", (operation, message) => {
      expect(interpret(operation, { status: "timed-out" })).toEqual({ status: "message", message });
    });

    it.each([
      ["sign-up", en.accountForms.signUp.resultUnknown],
      ["sign-in", en.accountForms.signIn.resultUnknown],
      ["sign-out", en.accountForms.signOut.resultUnknown],
    ] as const)("tells the person the result of a %s is unknown after a thrown error", (operation, message) => {
      const connectionLost = new TypeError("Failed to fetch");

      expect(interpret(operation, { status: "rejected", error: connectionLost })).toEqual({
        status: "message",
        message,
      });
    });

    it("says in a sign-up that the account may exist and that signing in can be tried", () => {
      const outcome = interpret("sign-up", { status: "timed-out" });

      expect(outcome).toEqual({ status: "message", message: expect.stringMatching(/already created.*signing in/i) });
    });

    it("says in a sign-out that the session may still be open", () => {
      const outcome = interpret("sign-out", { status: "timed-out" });

      expect(outcome).toEqual({ status: "message", message: expect.stringMatching(/session may still be open/i) });
    });

    it.each([
      ["a string", "boom"],
      ["undefined", undefined],
      ["an error with another message", new Error("Server Action not found")],
    ])("treats a thrown value that is %s as no usable answer", (_label, thrown) => {
      expect(interpret("sign-out", { status: "rejected", error: thrown })).toEqual({
        status: "message",
        message: en.accountForms.signOut.resultUnknown,
      });
    });
  });

  describe("the refusal of the page guard (plan D5)", () => {
    it("reads the 'signed out' refusal as a successful sign-out (FR-27)", () => {
      const refusal = new Error(SIGNED_OUT_ACTION_REFUSAL.text);

      expect(interpret("sign-out", { status: "rejected", error: refusal })).toEqual({ status: "succeeded" });
    });

    it("reads the 'could not check the session' refusal as an unconfirmed sign-out, not as signed out (FR-24, FR-28)", () => {
      const refusal = new Error(SESSION_CHECK_FAILED_ACTION_REFUSAL.text);

      expect(interpret("sign-out", { status: "rejected", error: refusal })).toEqual({
        status: "message",
        message: en.accountForms.signOut.resultUnknown,
      });
    });

    it("does not read a thrown value that only looks like the refusal as one", () => {
      expect(interpret("sign-out", { status: "rejected", error: SIGNED_OUT_ACTION_REFUSAL.text })).toEqual({
        status: "message",
        message: en.accountForms.signOut.resultUnknown,
      });
    });

    it.each(["sign-up", "sign-in"] as const)("does not apply the 'signed out' refusal to a %s", (operation) => {
      const refusal = new Error(SIGNED_OUT_ACTION_REFUSAL.text);

      expect(interpret(operation, { status: "rejected", error: refusal })).toMatchObject({ status: "message" });
    });

    it("uses distinct fixed texts and the statuses of the plan", () => {
      expect(SIGNED_OUT_ACTION_REFUSAL.status).toBe(401);
      expect(SESSION_CHECK_FAILED_ACTION_REFUSAL.status).toBe(503);
      expect(SIGNED_OUT_ACTION_REFUSAL.text).not.toBe(SESSION_CHECK_FAILED_ACTION_REFUSAL.text);
    });
  });
});
