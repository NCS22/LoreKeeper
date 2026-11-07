import { describe, expect, it } from "vitest";
import { readSafeTestDatabaseName } from "./test-database-guard";

const DEVELOPMENT_DATABASE_URL = "postgresql://dev-user:dev-secret-9@localhost:5432/lorekeeper";

function buildLocalUrl(databaseName: string): string {
  return `postgresql://someone:some-secret-1@localhost:5432/${databaseName}`;
}

function captureFailure(work: () => unknown): Error {
  try {
    work();
  } catch (failure) {
    return failure as Error;
  }
  throw new Error("Expected the guard to refuse");
}

describe("readSafeTestDatabaseName", () => {
  it.each(["lorekeeper_test", "x_test", "lorekeeper_test_two", "LoreKeeper_Test", "a_TEST"])(
    "accepts the database name %s and returns it",
    (databaseName) => {
      expect(readSafeTestDatabaseName(buildLocalUrl(databaseName), DEVELOPMENT_DATABASE_URL)).toBe(databaseName);
    },
  );

  it.each(["contest", "lorekeeper_latest", "lorekeeper", "test", "testing_lorekeeper", "my_test_data", "x-test", "x_test;drop"])(
    "refuses the database name %s",
    (databaseName) => {
      const failure = captureFailure(() => readSafeTestDatabaseName(buildLocalUrl(databaseName)));

      expect(failure.message).toContain("TEST_DATABASE_URL");
    },
  );

  it.each(["localhost", "127.0.0.1", "[::1]", "LOCALHOST"])("accepts the local host %s", (host) => {
    expect(readSafeTestDatabaseName(`postgresql://u:p@${host}:5432/lorekeeper_test`)).toBe("lorekeeper_test");
  });

  it.each(["db.example.com", "10.0.0.5", "192.168.1.20", "localhost.evil.example", "postgres"])(
    "refuses the non-local host %s",
    (host) => {
      const failure = captureFailure(() => readSafeTestDatabaseName(`postgresql://u:p@${host}:5432/lorekeeper_test`));

      expect(failure.message).toContain("TEST_DATABASE_URL");
    },
  );

  describe("query string in TEST_DATABASE_URL", () => {
    it.each([
      "?host=prod.example.com",
      "?port=5433",
      "?user=other-user",
      "?hostaddr=10.0.0.5",
      "?HOST=prod.example.com",
      "?dbname=production",
      "?sslmode=require",
      "?schema=public",
      "?connect_timeout=5&application_name=x",
    ])("refuses the query string %s even though host and name look safe", (queryString) => {
      const failure = captureFailure(() =>
        readSafeTestDatabaseName(`postgresql://some-user:some-password@localhost:5432/x_test${queryString}`),
      );

      expect(failure.message).toContain("TEST_DATABASE_URL");
      expect(failure.message).toContain("query string");
    });

    it("refuses the exact URL that used to connect elsewhere: a safe authority with ?host=", () => {
      expect(() =>
        readSafeTestDatabaseName("postgresql://u:p@localhost:5432/x_test?host=prod.example.com"),
      ).toThrow(/TEST_DATABASE_URL/);
    });

    it("never puts the query values, the user, the password or the host in the error", () => {
      const failure = captureFailure(() =>
        readSafeTestDatabaseName(
          "postgresql://some-user:some-password@localhost:5432/x_test?host=prod.example.com&user=other-user&port=6543",
        ),
      );

      expect(failure.message).not.toMatch(
        /some-user|some-password|other-user|prod\.example\.com|6543|localhost|x_test/,
      );
    });

    it("accepts the plain URL without any query string, as before", () => {
      expect(readSafeTestDatabaseName("postgresql://u:p@localhost:5432/x_test")).toBe("x_test");
    });
  });

  describe("compared with DATABASE_URL", () => {
    it.each([
      "?host=prod.example.com",
      "?hostaddr=10.0.0.5",
      "?port=6543",
      "?dbname=production",
      "?database=production",
      "?HOST=prod.example.com",
      "?sslmode=disable&host=prod.example.com",
    ])(
      "refuses to compare when DATABASE_URL overrides its location in the query string (%s)",
      (queryString) => {
        const failure = captureFailure(() =>
          readSafeTestDatabaseName(
            buildLocalUrl("lorekeeper_test"),
            `postgresql://dev-user:dev-secret-9@localhost:5432/lorekeeper${queryString}`,
          ),
        );

        expect(failure.message).toContain("DATABASE_URL");
        expect(failure.message).not.toMatch(/dev-user|dev-secret-9|prod\.example\.com|6543|production/);
      },
    );

    it("still compares when DATABASE_URL only has parameters that do not move the connection", () => {
      expect(
        readSafeTestDatabaseName(
          buildLocalUrl("lorekeeper_test"),
          "postgresql://dev-user:dev-secret-9@localhost:5432/lorekeeper?schema=public&sslmode=disable",
        ),
      ).toBe("lorekeeper_test");
      expect(() =>
        readSafeTestDatabaseName(
          buildLocalUrl("lorekeeper_test"),
          "postgresql://dev-user:dev-secret-9@localhost:5432/lorekeeper_test?schema=public",
        ),
      ).toThrow(/same database as DATABASE_URL/);
    });

    it("refuses the same host, port and database name", () => {
      const sameDatabase = "postgresql://other:other-secret-2@localhost:5432/lorekeeper_test";
      const developmentDatabase = "postgresql://dev-user:dev-secret-9@localhost:5432/lorekeeper_test";

      const failure = captureFailure(() => readSafeTestDatabaseName(sameDatabase, developmentDatabase));

      expect(failure.message).toContain("DATABASE_URL");
    });

    it("refuses it when the same machine is written another way, or the default port is left out", () => {
      const failure = captureFailure(() =>
        readSafeTestDatabaseName(
          "postgresql://u:p@127.0.0.1/lorekeeper_test",
          "postgresql://v:q@localhost:5432/lorekeeper_test",
        ),
      );

      expect(failure.message).toContain("DATABASE_URL");
    });

    it("accepts a different database name, or a different port", () => {
      expect(readSafeTestDatabaseName(buildLocalUrl("lorekeeper_test"), DEVELOPMENT_DATABASE_URL)).toBe(
        "lorekeeper_test",
      );
      expect(
        readSafeTestDatabaseName(
          "postgresql://u:p@localhost:5433/lorekeeper_test",
          "postgresql://u:p@localhost:5432/lorekeeper_test",
        ),
      ).toBe("lorekeeper_test");
    });

    it("does not compare when DATABASE_URL is not given", () => {
      expect(readSafeTestDatabaseName(buildLocalUrl("lorekeeper_test"))).toBe("lorekeeper_test");
    });
  });

  it("refuses an address that is not a URL, without echoing it", () => {
    const failure = captureFailure(() => readSafeTestDatabaseName("not-a-url-secret-text"));

    expect(failure.message).toContain("TEST_DATABASE_URL");
    expect(failure.message).not.toContain("not-a-url-secret-text");
  });

  it("never puts an address, a user or a password in the error", () => {
    const failures = [
      captureFailure(() => readSafeTestDatabaseName("postgresql://some-user:some-password@db.example.com:5432/contest")),
      captureFailure(() => readSafeTestDatabaseName("postgresql://some-user:some-password@localhost:5432/contest")),
      captureFailure(() =>
        readSafeTestDatabaseName(
          "postgresql://some-user:some-password@localhost:5432/lorekeeper_test",
          "postgresql://other-user:other-password@localhost:5432/lorekeeper_test",
        ),
      ),
    ];

    for (const failure of failures) {
      expect(failure.message).not.toMatch(/some-user|some-password|other-user|other-password|db\.example\.com/);
    }
  });
});
