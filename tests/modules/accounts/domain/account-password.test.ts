import { describe, expect, it } from "vitest";
import {
  MAXIMUM_ACCOUNT_PASSWORD_LENGTH,
  MINIMUM_ACCOUNT_PASSWORD_LENGTH,
  validateAccountPassword,
} from "@/modules/accounts/domain/account-password";

const LENGTH_ISSUE = {
  field: "password",
  code: "PASSWORD_LENGTH_OUT_OF_RANGE",
  minimumLength: 8,
  maximumLength: 128,
};

describe("validateAccountPassword", () => {
  it("exports the limits 8 and 128", () => {
    expect(MINIMUM_ACCOUNT_PASSWORD_LENGTH).toBe(8);
    expect(MAXIMUM_ACCOUNT_PASSWORD_LENGTH).toBe(128);
  });

  it("rejects 7 characters and reports both limits", () => {
    expect(validateAccountPassword("a".repeat(7))).toEqual({ isValid: false, issue: LENGTH_ISSUE });
  });

  it("rejects an empty password with the same issue", () => {
    expect(validateAccountPassword("")).toEqual({ isValid: false, issue: LENGTH_ISSUE });
  });

  it("accepts exactly 8 characters", () => {
    expect(validateAccountPassword("a".repeat(8))).toEqual({
      isValid: true,
      password: "a".repeat(8),
    });
  });

  it("accepts exactly 128 characters", () => {
    expect(validateAccountPassword("a".repeat(128))).toEqual({
      isValid: true,
      password: "a".repeat(128),
    });
  });

  it("rejects 129 characters and reports both limits", () => {
    expect(validateAccountPassword("a".repeat(129))).toEqual({ isValid: false, issue: LENGTH_ISSUE });
  });

  it("counts an astral character once", () => {
    expect(validateAccountPassword("😀".repeat(8))).toMatchObject({ isValid: true });
    expect(validateAccountPassword("😀".repeat(7))).toMatchObject({ isValid: false });
    expect(validateAccountPassword("😀".repeat(128))).toMatchObject({ isValid: true });
    expect(validateAccountPassword("😀".repeat(129))).toMatchObject({ isValid: false });
  });

  it("keeps leading and trailing spaces as typed and counts them", () => {
    expect(validateAccountPassword("  abc  d  ")).toEqual({ isValid: true, password: "  abc  d  " });
    expect(validateAccountPassword("        ")).toEqual({ isValid: true, password: "        " });
  });

  it("does not normalize: composed and decomposed forms stay different", () => {
    const composed = "café-café";
    const decomposed = "café-café";

    const composedResult = validateAccountPassword(composed);
    const decomposedResult = validateAccountPassword(decomposed);

    expect(composedResult).toEqual({ isValid: true, password: composed });
    expect(decomposedResult).toEqual({ isValid: true, password: decomposed });
    expect(composed).not.toBe(decomposed);
  });

  it("requires no mix of letter case, digits or symbols", () => {
    expect(validateAccountPassword("aaaaaaaa")).toMatchObject({ isValid: true });
    expect(validateAccountPassword("password")).toMatchObject({ isValid: true });
  });
});
