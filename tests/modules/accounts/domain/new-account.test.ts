import { describe, expect, it } from "vitest";
import { parseNewAccount } from "@/modules/accounts/domain/new-account";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";

const validInput = {
  displayName: "Ana",
  email: "ana@example.com",
  password: "correct horse",
  repeatPassword: "correct horse",
};

function captureIssues(run: () => unknown): readonly ValidationIssue[] {
  try {
    run();
  } catch (error) {
    if (error instanceof ValidationError) {
      return error.issues;
    }
    throw error;
  }
  throw new Error("Expected a ValidationError but nothing was thrown");
}

describe("parseNewAccount", () => {
  it("returns the trimmed display name, the comparable email and the password as typed", () => {
    expect(
      parseNewAccount({
        displayName: "  Ana   Maria  ",
        email: " Ana@Example.com ",
        password: "  correct horse  ",
        repeatPassword: "  correct horse  ",
      }),
    ).toEqual({
      displayName: "Ana   Maria",
      email: "ana@example.com",
      password: "  correct horse  ",
    });
  });

  it("reports every failing field together, in form order", () => {
    const issues = captureIssues(() =>
      parseNewAccount({
        displayName: "   ",
        email: "not-an-email",
        password: "short",
        repeatPassword: "different",
      }),
    );

    expect(issues).toEqual([
      { field: "displayName", code: "DISPLAY_NAME_REQUIRED" },
      { field: "email", code: "EMAIL_INVALID" },
      {
        field: "password",
        code: "PASSWORD_LENGTH_OUT_OF_RANGE",
        minimumLength: 8,
        maximumLength: 128,
      },
      { field: "repeatPassword", code: "PASSWORDS_DO_NOT_MATCH" },
    ]);
  });

  it("reports only the failing field when the others are valid", () => {
    expect(captureIssues(() => parseNewAccount({ ...validInput, displayName: "a".repeat(121) }))).toEqual([
      { field: "displayName", code: "DISPLAY_NAME_TOO_LONG", maximumLength: 120 },
    ]);
    expect(captureIssues(() => parseNewAccount({ ...validInput, displayName: "Ana\n" }))).toEqual([
      { field: "displayName", code: "DISPLAY_NAME_INVALID_CHARACTERS" },
    ]);
    expect(captureIssues(() => parseNewAccount({ ...validInput, email: "añ@example.com" }))).toEqual([
      { field: "email", code: "EMAIL_INVALID" },
    ]);
  });

  it("reports an issue on the repeat field when it differs from the password", () => {
    expect(captureIssues(() => parseNewAccount({ ...validInput, repeatPassword: "correct horse!" }))).toEqual([
      { field: "repeatPassword", code: "PASSWORDS_DO_NOT_MATCH" },
    ]);
  });

  it("treats a repeat that differs only in surrounding spaces as different", () => {
    expect(captureIssues(() => parseNewAccount({ ...validInput, repeatPassword: "correct horse " }))).toEqual([
      { field: "repeatPassword", code: "PASSWORDS_DO_NOT_MATCH" },
    ]);
  });

  it("adds no repeat issue when the repeat equals an invalid password", () => {
    expect(captureIssues(() => parseNewAccount({ ...validInput, password: "short", repeatPassword: "short" }))).toEqual([
      {
        field: "password",
        code: "PASSWORD_LENGTH_OUT_OF_RANGE",
        minimumLength: 8,
        maximumLength: 128,
      },
    ]);
  });

  it("reports the repeat mismatch even when the password is invalid", () => {
    const issues = captureIssues(() =>
      parseNewAccount({ ...validInput, password: "short", repeatPassword: "other" }),
    );

    expect(issues.map((issue) => issue.field)).toEqual(["password", "repeatPassword"]);
  });
});
