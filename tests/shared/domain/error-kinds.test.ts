import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain/domain-error";
import * as errorKinds from "@/shared/domain/error-kinds";
import {
  AuthenticationError,
  BusinessRuleViolationError,
  ExternalProviderError,
  InfrastructureError,
  NotFoundError,
} from "@/shared/domain/error-kinds";
import { ValidationError } from "@/shared/domain/validation-error";

describe("error kinds", () => {
  const errorKindsWithTheirCodes = [
    { build: () => new AuthenticationError("x"), code: "AUTHENTICATION_ERROR", name: "AuthenticationError" },
    { build: () => new NotFoundError("x"), code: "NOT_FOUND", name: "NotFoundError" },
    {
      build: () => new BusinessRuleViolationError("x"),
      code: "BUSINESS_RULE_VIOLATION",
      name: "BusinessRuleViolationError",
    },
    { build: () => new InfrastructureError("x"), code: "INFRASTRUCTURE_ERROR", name: "InfrastructureError" },
    {
      build: () => new ExternalProviderError("x"),
      code: "EXTERNAL_PROVIDER_ERROR",
      name: "ExternalProviderError",
    },
  ];

  it.each(errorKindsWithTheirCodes)("$name has the stable code $code", ({ build, code, name }) => {
    const error = build();

    expect(error.code).toBe(code);
    expect(error.name).toBe(name);
    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
  });

  it("keeps the message it was given", () => {
    expect(new NotFoundError("the universe is not there").message).toBe("the universe is not there");
  });

  it("keeps the cause of an infrastructure or external provider failure", () => {
    const originalFailure = new Error("connection refused");

    expect(new InfrastructureError("x", { cause: originalFailure }).cause).toBe(originalFailure);
    expect(new ExternalProviderError("x", { cause: originalFailure }).cause).toBe(originalFailure);
    expect(new InfrastructureError("x").cause).toBeUndefined();
    expect(new ExternalProviderError("x").cause).toBeUndefined();
  });

  it("gives the six error kinds six different codes (the seventh, unknown, is not a class)", () => {
    const codes = [
      ...errorKindsWithTheirCodes.map(({ build }) => build().code),
      new ValidationError([]).code,
    ];

    expect(new Set(codes).size).toBe(6);
  });

  it("exports exactly the five error classes and no authorization class (the kind is reserved)", () => {
    const exportedClassNames = Object.entries(errorKinds)
      .filter(([, exportedValue]) => typeof exportedValue === "function")
      .map(([exportedName]) => exportedName)
      .sort();

    expect(exportedClassNames).toEqual([
      "AuthenticationError",
      "BusinessRuleViolationError",
      "ExternalProviderError",
      "InfrastructureError",
      "NotFoundError",
    ]);
    expect(Object.keys(errorKinds).some((exportedName) => /authori[sz]ation/i.test(exportedName))).toBe(
      false,
    );
  });
});
