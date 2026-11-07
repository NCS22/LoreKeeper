import { describe, expect, it } from "vitest";
import {
  MAXIMUM_ACCOUNT_EMAIL_LENGTH,
  toComparableEmail,
  validateAccountEmail,
} from "@/modules/accounts/domain/account-email";
import {
  NOT_VALID_EMAIL_EXAMPLES,
  TOO_LONG_EMAIL_EXAMPLE,
  VALID_EMAIL_BOUNDARY_EXAMPLES,
  VALID_EMAIL_EXAMPLES,
  buildEmailOfLength,
} from "../../../support/account-email-examples";

const EMAIL_INVALID_RESULT = {
  isValid: false,
  issue: { field: "email", code: "EMAIL_INVALID" },
};

describe("toComparableEmail", () => {
  it("removes surrounding whitespace and lower-cases", () => {
    expect(toComparableEmail(" Ana@Example.com ")).toBe("ana@example.com");
  });

  it("is the same for emails that differ only in case and surrounding whitespace", () => {
    expect(toComparableEmail("\tANA@EXAMPLE.COM\n")).toBe(toComparableEmail("ana@example.com"));
  });
});

describe("validateAccountEmail", () => {
  it("allows a maximum of 254 characters", () => {
    expect(MAXIMUM_ACCOUNT_EMAIL_LENGTH).toBe(254);
  });

  it("accepts an email and returns it in its comparable form", () => {
    expect(validateAccountEmail(" Ana@Example.com ")).toEqual({
      isValid: true,
      email: "ana@example.com",
    });
  });

  it.each(VALID_EMAIL_EXAMPLES)("accepts the valid example %s", (rawEmail) => {
    expect(validateAccountEmail(rawEmail)).toEqual({
      isValid: true,
      email: rawEmail.toLowerCase(),
    });
  });

  it("accepts an email of exactly 254 characters", () => {
    const email = buildEmailOfLength(254);

    expect(email).toHaveLength(254);
    expect(validateAccountEmail(email)).toEqual({ isValid: true, email });
  });

  it.each(VALID_EMAIL_BOUNDARY_EXAMPLES)("accepts the boundary example of %#", (rawEmail) => {
    expect(validateAccountEmail(rawEmail)).toMatchObject({ isValid: true });
  });

  it("rejects an email of 255 characters", () => {
    expect(TOO_LONG_EMAIL_EXAMPLE).toHaveLength(255);
    expect(validateAccountEmail(TOO_LONG_EMAIL_EXAMPLE)).toEqual(EMAIL_INVALID_RESULT);
  });

  it("counts the length after removing surrounding whitespace", () => {
    expect(validateAccountEmail(`  ${buildEmailOfLength(254)}  `)).toMatchObject({ isValid: true });
  });

  it.each(NOT_VALID_EMAIL_EXAMPLES)("rejects the not-valid example %s", (rawEmail) => {
    expect(validateAccountEmail(rawEmail)).toEqual(EMAIL_INVALID_RESULT);
  });

  it("rejects an email that starts with the Kelvin sign, which lower-cases to a plain k", () => {
    const emailWithKelvinSign = "Kana@example.com";

    expect(emailWithKelvinSign.toLowerCase()).toBe("kana@example.com");
    expect(validateAccountEmail(emailWithKelvinSign)).toEqual(EMAIL_INVALID_RESULT);
  });

  it.each([
    ["an empty value", ""],
    ["only whitespace", "   "],
    ["no @", "ana.example.com"],
    ["two separated @", "ana@home@example.com"],
    ["an inner space", "ana maria@example.com"],
    ["a space around the domain", "ana@exa mple.com"],
    ["non-Latin characters", "星@example.com"],
    ["an empty local part", "@example.com"],
    ["an empty domain", "ana@"],
    ["an inner line break", "ana\n@example.com"],
    ["a line break after the domain", "ana@example.com\nx"],
    ["a bare host name", "ana@localhost"],
  ])("rejects %s", (_description, rawEmail) => {
    expect(validateAccountEmail(rawEmail)).toEqual(EMAIL_INVALID_RESULT);
  });
});
