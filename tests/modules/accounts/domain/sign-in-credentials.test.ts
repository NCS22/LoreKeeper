import { describe, expect, it } from "vitest";
import { parseSignInCredentials } from "@/modules/accounts/domain/sign-in-credentials";
import { ValidationError, type ValidationIssue } from "@/shared/domain/validation-error";

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

describe("parseSignInCredentials", () => {
  it("returns the comparable email and the password exactly as typed", () => {
    expect(parseSignInCredentials({ email: " Ana@Example.com ", password: " secret " })).toEqual({
      email: "ana@example.com",
      password: " secret ",
    });
  });

  it("reports an empty email", () => {
    expect(captureIssues(() => parseSignInCredentials({ email: "", password: "secret" }))).toEqual([
      { field: "email", code: "EMAIL_REQUIRED" },
    ]);
  });

  it("reports an email that is empty after trimming", () => {
    expect(captureIssues(() => parseSignInCredentials({ email: " \t ", password: "secret" }))).toEqual([
      { field: "email", code: "EMAIL_REQUIRED" },
    ]);
  });

  it("reports an empty password", () => {
    expect(captureIssues(() => parseSignInCredentials({ email: "ana@example.com", password: "" }))).toEqual([
      { field: "password", code: "PASSWORD_REQUIRED" },
    ]);
  });

  it("reports both empty fields together", () => {
    expect(captureIssues(() => parseSignInCredentials({ email: "", password: "" }))).toEqual([
      { field: "email", code: "EMAIL_REQUIRED" },
      { field: "password", code: "PASSWORD_REQUIRED" },
    ]);
  });

  it("does not trim the password: spaces only is a password to check", () => {
    expect(parseSignInCredentials({ email: "ana@example.com", password: "   " })).toEqual({
      email: "ana@example.com",
      password: "   ",
    });
  });

  it("lets an invalid email and a 3-character password through to the credential check", () => {
    expect(parseSignInCredentials({ email: "not an email", password: "abc" })).toEqual({
      email: "not an email",
      password: "abc",
    });
  });

  it("lets a 129-character password through", () => {
    const password = "a".repeat(129);

    expect(parseSignInCredentials({ email: "ana@example.com", password }).password).toBe(password);
  });
});
