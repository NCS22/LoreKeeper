import { afterEach, describe, expect, it, vi } from "vitest";
import { InfrastructureError } from "@/shared/domain/error-kinds";
import { readServerEnvironment } from "@/shared/infrastructure/server-environment";

const validEnvironmentVariables = {
  DATABASE_URL: "postgresql://someone:database-password-1@localhost:5432/lorekeeper",
  BETTER_AUTH_SECRET: "s".repeat(40),
  BETTER_AUTH_URL: "http://localhost:3000",
};

afterEach(() => {
  vi.unstubAllEnvs();
  vi.resetModules();
});

describe("readServerEnvironment", () => {
  it("returns the three validated values", () => {
    expect(readServerEnvironment(validEnvironmentVariables)).toEqual({
      databaseUrl: validEnvironmentVariables.DATABASE_URL,
      authSecret: validEnvironmentVariables.BETTER_AUTH_SECRET,
      authBaseUrl: validEnvironmentVariables.BETTER_AUTH_URL,
    });
  });

  it("reads process.env when no source is given, at the moment of the call", () => {
    for (const [name, value] of Object.entries(validEnvironmentVariables)) {
      vi.stubEnv(name, value);
    }
    expect(readServerEnvironment().authBaseUrl).toBe(validEnvironmentVariables.BETTER_AUTH_URL);
  });

  it.each(Object.keys(validEnvironmentVariables))(
    "fails with an infrastructure error naming %s when it is missing",
    (missingName) => {
      const incompleteVariables: Record<string, string | undefined> = {
        ...validEnvironmentVariables,
        [missingName]: undefined,
      };

      const failure = captureFailure(() => readServerEnvironment(incompleteVariables));

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect(failure.message).toContain(missingName);
    },
  );

  it.each([
    ["DATABASE_URL", "not a url"],
    ["BETTER_AUTH_URL", "not a url"],
    ["BETTER_AUTH_SECRET", "too-short-secret"],
  ])("does not echo the value when %s is invalid", (invalidName, invalidValue) => {
    const failure = captureFailure(() =>
      readServerEnvironment({ ...validEnvironmentVariables, [invalidName]: invalidValue }),
    );

    expect(failure).toBeInstanceOf(InfrastructureError);
    expect(failure.message).toContain(invalidName);
    expect(failure.message).not.toContain(invalidValue);
  });

  describe("placeholders copied from .env.example and never replaced", () => {
    const PLACEHOLDER_AUTH_SECRET = "replace-with-a-long-random-string-of-at-least-32-characters";
    const PLACEHOLDER_DATABASE_URL =
      "postgresql://lorekeeper:replace-with-your-database-password@localhost:5432/lorekeeper";

    it.each([
      ["BETTER_AUTH_SECRET", PLACEHOLDER_AUTH_SECRET],
      ["BETTER_AUTH_SECRET", PLACEHOLDER_AUTH_SECRET.toUpperCase()],
      ["DATABASE_URL", PLACEHOLDER_DATABASE_URL],
    ])("rejects %s with the placeholder, naming the variable and no value", (placeholderName, placeholderValue) => {
      const failure = captureFailure(() =>
        readServerEnvironment({ ...validEnvironmentVariables, [placeholderName]: placeholderValue }),
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect(failure.message).toContain(placeholderName);
      expect(failure.message).not.toContain(placeholderValue);
      expect(failure.message).not.toContain("replace-with");
    });

    it.each([
      ["a malformed percent sequence after the placeholder", "postgresql://u:replace-with-100%zz@localhost:5432/lorekeeper"],
      ["a lone percent sign after the placeholder", "postgresql://u:replace-with-100%@localhost:5432/lorekeeper"],
      ["an upper-case placeholder with a malformed sequence", "postgresql://u:REPLACE-WITH-%zz@localhost:5432/lorekeeper"],
      ["a percent-encoded placeholder", "postgresql://u:%72eplace-with-it@localhost:5432/lorekeeper"],
      ["a password query parameter", "postgresql://u@localhost:5432/lorekeeper?password=replace-with-your-password"],
      [
        "a password query parameter with a malformed sequence",
        "postgresql://u@localhost:5432/lorekeeper?password=replace-with-100%zz",
      ],
    ])("rejects DATABASE_URL with %s, naming the variable and no value", (_label, databaseUrl) => {
      const failure = captureFailure(() =>
        readServerEnvironment({ ...validEnvironmentVariables, DATABASE_URL: databaseUrl }),
      );

      expect(failure).toBeInstanceOf(InfrastructureError);
      expect(failure.message).toContain("DATABASE_URL");
      expect(failure.message).not.toContain(databaseUrl);
      expect(failure.message).not.toContain("replace-with");
    });

    it("accepts a DATABASE_URL with a malformed percent sequence in a real password, so the rejection above is about the placeholder", () => {
      const databaseUrl = "postgresql://u:real-secret-100%zz@localhost:5432/lorekeeper";

      expect(readServerEnvironment({ ...validEnvironmentVariables, DATABASE_URL: databaseUrl }).databaseUrl).toBe(
        databaseUrl,
      );
    });

    it("accepts a long random secret, such as the output of openssl rand -base64 48", () => {
      const randomSecret = "k3J9xQ2mV8nL0aZ7pR5tW1yB6cD4eF+gH/uI2oS8vXq9Ae3Mn7Kz5Tw1Yb0Cd6Ef";

      expect(readServerEnvironment({ ...validEnvironmentVariables, BETTER_AUTH_SECRET: randomSecret }).authSecret).toBe(
        randomSecret,
      );
    });

    it("accepts a secret that only contains the words later in the text", () => {
      const secretWithTheWordsLater = `x-replace-with-${"q".repeat(40)}`;

      expect(
        readServerEnvironment({ ...validEnvironmentVariables, BETTER_AUTH_SECRET: secretWithTheWordsLater }).authSecret,
      ).toBe(secretWithTheWordsLater);
    });
  });

  it("never echoes any valid value when another one is missing", () => {
    const failure = captureFailure(() =>
      readServerEnvironment({ ...validEnvironmentVariables, BETTER_AUTH_URL: undefined }),
    );

    for (const value of Object.values(validEnvironmentVariables)) {
      expect(failure.message).not.toContain(value);
    }
  });

  it("reads nothing at import time: importing without any variable does not throw", async () => {
    for (const name of Object.keys(validEnvironmentVariables)) {
      vi.stubEnv(name, undefined);
    }
    vi.resetModules();

    await expect(import("@/shared/infrastructure/server-environment")).resolves.toBeDefined();
  });
});

function captureFailure(work: () => unknown): Error {
  try {
    work();
  } catch (failure) {
    return failure as Error;
  }
  throw new Error("Expected the call to fail");
}
