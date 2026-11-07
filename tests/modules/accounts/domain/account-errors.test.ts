import { describe, expect, it } from "vitest";
import {
  EmailAlreadyRegisteredError,
  InvalidCredentialsError,
} from "@/modules/accounts/domain/account-errors";
import { AuthenticationError, BusinessRuleViolationError } from "@/shared/domain/error-kinds";

describe("account errors", () => {
  it("EmailAlreadyRegisteredError is a business rule violation with its code", () => {
    const error = new EmailAlreadyRegisteredError();

    expect(error).toBeInstanceOf(BusinessRuleViolationError);
    expect(error.code).toBe("BUSINESS_RULE_VIOLATION");
    expect(error.name).toBe("EmailAlreadyRegisteredError");
  });

  it("InvalidCredentialsError is an authentication error with its code", () => {
    const error = new InvalidCredentialsError();

    expect(error).toBeInstanceOf(AuthenticationError);
    expect(error.code).toBe("AUTHENTICATION_ERROR");
    expect(error.name).toBe("InvalidCredentialsError");
  });

  it("InvalidCredentialsError has one fixed message that names neither the email nor the password", () => {
    expect(new InvalidCredentialsError().message).toBe(new InvalidCredentialsError().message);
    expect(new InvalidCredentialsError().message).not.toMatch(/unknown|not registered|wrong password/i);
  });
});
