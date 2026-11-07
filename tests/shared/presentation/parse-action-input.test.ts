import { describe, expect, it } from "vitest";
import { z } from "zod";
import { ValidationError } from "@/shared/domain/validation-error";
import {
  INVALID_INPUT_ISSUE_CODE,
  MAXIMUM_REPORTED_FIELD_NAME_LENGTH,
  MAXIMUM_REPORTED_FIELDS,
  parseActionInput,
  WHOLE_INPUT_FIELD,
} from "@/shared/presentation/parse-action-input";

const signInShapeSchema = z.strictObject({ email: z.string(), password: z.string() });

function captureValidationError(input: unknown): ValidationError {
  try {
    parseActionInput(signInShapeSchema, input);
  } catch (error) {
    if (error instanceof ValidationError) {
      return error;
    }
    throw error;
  }
  throw new Error("The input was accepted.");
}

describe("parseActionInput", () => {
  it("returns the parsed input when the shape is right", () => {
    expect(parseActionInput(signInShapeSchema, { email: "ana@example.com", password: "x" })).toEqual({
      email: "ana@example.com",
      password: "x",
    });
  });

  it("keeps text as typed: no trimming and no business rule", () => {
    expect(parseActionInput(signInShapeSchema, { email: " A ", password: "" })).toEqual({
      email: " A ",
      password: "",
    });
  });

  it("rejects an unknown key such as userId, keyed by that key", () => {
    const validationError = captureValidationError({
      email: "ana@example.com",
      password: "x",
      userId: "another-account",
    });

    expect(validationError.issues).toEqual([{ field: "userId", code: INVALID_INPUT_ISSUE_CODE }]);
  });

  it("rejects a value that is not a string, keyed by its field", () => {
    const validationError = captureValidationError({ email: 42, password: ["x"] });

    expect(validationError.issues).toEqual([
      { field: "email", code: INVALID_INPUT_ISSUE_CODE },
      { field: "password", code: INVALID_INPUT_ISSUE_CODE },
    ]);
  });

  it("rejects a missing field", () => {
    const validationError = captureValidationError({ email: "ana@example.com" });

    expect(validationError.issues).toEqual([{ field: "password", code: INVALID_INPUT_ISSUE_CODE }]);
  });

  it("reports an unknown key and a wrong value together", () => {
    const validationError = captureValidationError({ email: null, password: "x", userId: "y" });

    expect(validationError.issues.map((issue) => issue.field).sort()).toEqual(["email", "userId"]);
  });

  it.each([null, undefined, "text", 7, ["a"]])(
    "rejects input that is not an object (%j) as a whole",
    (input) => {
      expect(captureValidationError(input).issues).toEqual([
        { field: WHOLE_INPUT_FIELD, code: INVALID_INPUT_ISSUE_CODE },
      ]);
    },
  );

  it("names nested fields with their path", () => {
    const nestedSchema = z.strictObject({ credentials: z.strictObject({ email: z.string() }) });

    expect(() => parseActionInput(nestedSchema, { credentials: { email: 1 } })).toThrow(
      expect.objectContaining({
        issues: [{ field: "credentials.email", code: INVALID_INPUT_ISSUE_CODE }],
      }),
    );
  });

  describe("a hostile body does not turn the answer into an echo", () => {
    it("reports at most the first twelve fields, in order, for a body with thousands of unknown keys", () => {
      const thousandsOfKeys = Object.fromEntries(
        Array.from({ length: 5000 }, (_unused, index) => [`unknown${index}`, "x"]),
      );

      const validationError = captureValidationError({
        email: "ana@example.com",
        password: "x",
        ...thousandsOfKeys,
      });

      expect(MAXIMUM_REPORTED_FIELDS).toBe(12);
      expect(validationError.issues).toHaveLength(MAXIMUM_REPORTED_FIELDS);
      expect(validationError.issues.map((issue) => issue.field)).toEqual(
        Array.from({ length: MAXIMUM_REPORTED_FIELDS }, (_unused, index) => `unknown${index}`),
      );
      expect(validationError.issues.every((issue) => issue.code === INVALID_INPUT_ISSUE_CODE)).toBe(true);
    });

    it("reports every field when there are few, the failing known ones and the unknown key userId", () => {
      const validationError = captureValidationError({ email: 1, password: 2, userId: "another-account" });

      expect(validationError.issues.map((issue) => issue.field).sort()).toEqual(["email", "password", "userId"]);
    });

    it("still rejects a body made only of unknown keys, such as userId (FR-21)", () => {
      const validationError = captureValidationError({
        email: "ana@example.com",
        password: "x",
        userId: "another-account",
        ...Object.fromEntries(Array.from({ length: 100 }, (_unused, index) => [`extra${index}`, 1])),
      });

      expect(validationError.issues[0]).toEqual({ field: "userId", code: INVALID_INPUT_ISSUE_CODE });
      expect(validationError.issues).toHaveLength(MAXIMUM_REPORTED_FIELDS);
    });

    it("truncates a very long key to sixty-four characters", () => {
      const veryLongKey = "k".repeat(100_000);

      const validationError = captureValidationError({
        email: "ana@example.com",
        password: "x",
        [veryLongKey]: "x",
      });

      expect(MAXIMUM_REPORTED_FIELD_NAME_LENGTH).toBe(64);
      expect(validationError.issues).toEqual([
        { field: "k".repeat(MAXIMUM_REPORTED_FIELD_NAME_LENGTH), code: INVALID_INPUT_ISSUE_CODE },
      ]);
      expect(JSON.stringify(validationError.issues).length).toBeLessThan(200);
    });

    it("reports once a name that two long keys share after truncation", () => {
      const sharedStart = "s".repeat(MAXIMUM_REPORTED_FIELD_NAME_LENGTH);

      const validationError = captureValidationError({
        email: "ana@example.com",
        password: "x",
        [`${sharedStart}-first`]: 1,
        [`${sharedStart}-second`]: 1,
      });

      expect(validationError.issues).toEqual([{ field: sharedStart, code: INVALID_INPUT_ISSUE_CODE }]);
    });

    it("does not split a character made of two UTF-16 units when it cuts a long name", () => {
      const emojiKey = "😀".repeat(100);

      const validationError = captureValidationError({
        email: "ana@example.com",
        password: "x",
        [emojiKey]: 1,
      });

      expect(validationError.issues).toEqual([
        { field: "😀".repeat(MAXIMUM_REPORTED_FIELD_NAME_LENGTH), code: INVALID_INPUT_ISSUE_CODE },
      ]);
    });

    it("keeps a name of exactly sixty-four characters whole", () => {
      const exactKey = "n".repeat(MAXIMUM_REPORTED_FIELD_NAME_LENGTH);

      const validationError = captureValidationError({ email: "ana@example.com", password: "x", [exactKey]: 1 });

      expect(validationError.issues).toEqual([{ field: exactKey, code: INVALID_INPUT_ISSUE_CODE }]);
    });

    it("limits long nested paths too", () => {
      const nestedSchema = z.strictObject({ credentials: z.record(z.string(), z.string()) });
      const longInnerKey = "i".repeat(500);

      expect(() => parseActionInput(nestedSchema, { credentials: { [longInnerKey]: 1 } })).toThrow(
        expect.objectContaining({
          issues: [
            { field: `credentials.${longInnerKey}`.slice(0, MAXIMUM_REPORTED_FIELD_NAME_LENGTH), code: INVALID_INPUT_ISSUE_CODE },
          ],
        }),
      );
    });
  });

  it("does not echo the rejected values in the error", () => {
    const validationError = captureValidationError({ email: 1234567, password: "x", userId: "secret-id" });

    expect(JSON.stringify(validationError.issues)).not.toContain("1234567");
    expect(validationError.message).not.toContain("secret-id");
  });
});
