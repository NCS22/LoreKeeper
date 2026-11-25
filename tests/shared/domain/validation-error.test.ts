import { describe, expect, it } from "vitest";
import { DomainError } from "@/shared/domain/domain-error";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";

describe("ValidationError", () => {
  const issues: readonly ValidationIssue[] = [
    { field: "name", code: "NAME_TOO_LONG", maximumLength: 120 },
    { field: "password", code: "PASSWORD_LENGTH_OUT_OF_RANGE", minimumLength: 8, maximumLength: 128 },
    { field: "mode", code: "MODE_INVALID" },
  ];

  it("keeps every issue with its details in the order it was given", () => {
    const error = new ValidationError(issues);

    expect(error.issues).toEqual([
      { field: "name", code: "NAME_TOO_LONG", maximumLength: 120 },
      { field: "password", code: "PASSWORD_LENGTH_OUT_OF_RANGE", minimumLength: 8, maximumLength: 128 },
      { field: "mode", code: "MODE_INVALID" },
    ]);
  });

  it("has a stable code", () => {
    expect(new ValidationError(issues).code).toBe("VALIDATION_ERROR");
    expect(new ValidationError([]).code).toBe("VALIDATION_ERROR");
  });

  it("is a domain error and a regular error with its own name", () => {
    const error = new ValidationError(issues);

    expect(error).toBeInstanceOf(DomainError);
    expect(error).toBeInstanceOf(Error);
    expect(error.name).toBe("ValidationError");
  });

  it("names the failing fields in its message", () => {
    expect(new ValidationError(issues).message).toBe("Validation failed for: name, password, mode");
  });
});
