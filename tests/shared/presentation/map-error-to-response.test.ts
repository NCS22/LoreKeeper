import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  AuthenticationError,
  BusinessRuleViolationError,
  ExternalProviderError,
  InfrastructureError,
  NotFoundError,
} from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";
import { logServerError } from "@/shared/infrastructure/server-error-logger";
import { ERROR_MESSAGE_BY_CODE } from "@/shared/presentation/error-messages";
import { mapErrorToResponse, STATUS_BY_ERROR_CODE } from "@/shared/presentation/map-error-to-response";

vi.mock("@/shared/infrastructure/server-error-logger", () => ({ logServerError: vi.fn() }));

const sensitiveText =
  "SELECT * FROM \"User\" WHERE password = 'hunter2-typed-password' at /srv/app/prisma-client.ts:42";

beforeEach(() => {
  vi.mocked(logServerError).mockClear();
});

describe("mapErrorToResponse", () => {
  const expectedResponses = [
    { name: "ValidationError", error: new ValidationError([{ field: "name", code: "X" }]), code: "VALIDATION_ERROR", status: 400 },
    { name: "AuthenticationError", error: new AuthenticationError(sensitiveText), code: "AUTHENTICATION_ERROR", status: 401 },
    { name: "NotFoundError", error: new NotFoundError(sensitiveText), code: "NOT_FOUND", status: 404 },
    {
      name: "BusinessRuleViolationError",
      error: new BusinessRuleViolationError(sensitiveText),
      code: "BUSINESS_RULE_VIOLATION",
      status: 422,
    },
    { name: "InfrastructureError", error: new InfrastructureError(sensitiveText), code: "INFRASTRUCTURE_ERROR", status: 500 },
    { name: "ExternalProviderError", error: new ExternalProviderError(sensitiveText), code: "EXTERNAL_PROVIDER_ERROR", status: 502 },
    { name: "an unknown error", error: new Error(sensitiveText), code: "UNKNOWN_ERROR", status: 500 },
    { name: "a thrown string", error: sensitiveText, code: "UNKNOWN_ERROR", status: 500 },
    { name: "a thrown null", error: null, code: "UNKNOWN_ERROR", status: 500 },
  ];

  it.each(expectedResponses)("maps $name to $code with status $status", ({ error, code, status }) => {
    const response = mapErrorToResponse(error);

    expect(response.status).toBe(status);
    expect(response.body.code).toBe(code);
    expect(response.body.message).toBe(ERROR_MESSAGE_BY_CODE[code as keyof typeof ERROR_MESSAGE_BY_CODE]);
  });

  it("maps a subclass of an error kind like its kind", () => {
    class InvalidCredentialsLikeError extends AuthenticationError {}

    const response = mapErrorToResponse(new InvalidCredentialsLikeError("x"));

    expect(response.status).toBe(401);
    expect(response.body.code).toBe("AUTHENTICATION_ERROR");
  });

  it("never puts a stack, a query, a credential or an internal name in any body", () => {
    for (const { error } of expectedResponses) {
      const serializedBody = JSON.stringify(mapErrorToResponse(error).body);

      expect(serializedBody).not.toContain("SELECT");
      expect(serializedBody).not.toContain("hunter2");
      expect(serializedBody).not.toContain("prisma-client");
      expect(serializedBody).not.toContain("InfrastructureError");
      expect(serializedBody).not.toContain(" at ");
    }
  });

  it("gives every code a different, non-empty generic sentence", () => {
    const messages = Object.values(ERROR_MESSAGE_BY_CODE);

    expect(messages.every((message) => message.length > 0)).toBe(true);
    expect(new Set(messages).size).toBe(messages.length);
  });

  it("has a table that is complete and closed: seven codes with their statuses", () => {
    expect(STATUS_BY_ERROR_CODE).toEqual({
      VALIDATION_ERROR: 400,
      AUTHENTICATION_ERROR: 401,
      NOT_FOUND: 404,
      BUSINESS_RULE_VIOLATION: 422,
      INFRASTRUCTURE_ERROR: 500,
      EXTERNAL_PROVIDER_ERROR: 502,
      UNKNOWN_ERROR: 500,
    });
    expect(Object.keys(ERROR_MESSAGE_BY_CODE).sort()).toEqual(Object.keys(STATUS_BY_ERROR_CODE).sort());
    expect(Object.values(STATUS_BY_ERROR_CODE)).not.toContain(403);
  });

  it("never answers with a code outside the closed list", () => {
    for (const { error } of expectedResponses) {
      expect(Object.keys(STATUS_BY_ERROR_CODE)).toContain(mapErrorToResponse(error).body.code);
    }
  });

  describe("field errors", () => {
    it("keys the issues by field and keeps the numeric details", () => {
      const response = mapErrorToResponse(
        new ValidationError([
          { field: "password", code: "PASSWORD_LENGTH_OUT_OF_RANGE", minimumLength: 8, maximumLength: 128 },
          { field: "displayName", code: "REQUIRED" },
          { field: "displayName", code: "TOO_LONG", maximumLength: 120 },
        ]),
      );

      expect(response.body.fieldErrors).toEqual({
        password: [{ code: "PASSWORD_LENGTH_OUT_OF_RANGE", minimumLength: 8, maximumLength: 128 }],
        displayName: [{ code: "REQUIRED" }, { code: "TOO_LONG", maximumLength: 120 }],
      });
    });

    it("leaves out the numeric details an issue does not have", () => {
      const response = mapErrorToResponse(new ValidationError([{ field: "email", code: "INVALID" }]));

      expect(response.body.fieldErrors?.email?.[0]).toStrictEqual({ code: "INVALID" });
    });

    it("exists only for the validation kind", () => {
      for (const { error, code } of expectedResponses) {
        if (code !== "VALIDATION_ERROR") {
          expect(mapErrorToResponse(error).body).not.toHaveProperty("fieldErrors");
        }
      }
    });
  });

  describe("logging", () => {
    it("logs an infrastructure error with its cause", () => {
      const cause = new Error("connection refused");
      const error = new InfrastructureError("Database unavailable", { cause });

      mapErrorToResponse(error);

      expect(logServerError).toHaveBeenCalledTimes(1);
      expect(logServerError).toHaveBeenCalledWith(error, { errorCode: "INFRASTRUCTURE_ERROR" });
      expect(vi.mocked(logServerError).mock.calls[0]?.[0]).toHaveProperty("cause", cause);
    });

    it("logs an unknown error with its original value", () => {
      const error = new TypeError("boom");

      mapErrorToResponse(error);

      expect(logServerError).toHaveBeenCalledWith(error, { errorCode: "UNKNOWN_ERROR" });
    });

    it("does not log the kinds the caller can fix or expects", () => {
      mapErrorToResponse(new ValidationError([]));
      mapErrorToResponse(new AuthenticationError("x"));
      mapErrorToResponse(new NotFoundError("x"));
      mapErrorToResponse(new BusinessRuleViolationError("x"));

      expect(logServerError).not.toHaveBeenCalled();
    });
  });
});
