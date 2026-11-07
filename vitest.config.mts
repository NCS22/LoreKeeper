import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { configDefaults, defineConfig } from "vitest/config";

// Test files that talk to PostgreSQL. They share one test database, so they run one file at a time.
// A new database-backed test goes in one of these folders.
const DATABASE_BACKED_TEST_FILES = [
  "tests/shared/infrastructure/**/*.test.ts",
  "tests/modules/*/infrastructure/**/*.test.ts",
  "tests/app/**/*.test.ts",
];

// The test database address comes from the shell or from `.env`. The file is read here, as tool
// configuration, and only this one variable is taken from it: the rest of `.env` (the development
// database, the auth secret) never reaches the tests.
function readTestDatabaseUrl(): string | undefined {
  const urlFromShell = process.env.TEST_DATABASE_URL;
  if (urlFromShell) {
    return urlFromShell;
  }
  if (!existsSync(".env")) {
    return undefined;
  }
  return parseEnv(readFileSync(".env", "utf8")).TEST_DATABASE_URL || undefined;
}

export default defineConfig({
  resolve: {
    alias: { "@": fileURLToPath(new URL("./src", import.meta.url)) },
  },
  test: {
    // The cookie plugin of Better Auth loads `next/headers` by itself. Tests replace that module
    // with an emulated cookie jar, and a replacement only reaches code that Vitest processes.
    // It is set for every project, not only the database one: measured, the database tests lost
    // the session cookie whenever a unit test file (the composition test) imported Better Auth in
    // the same run without this setting.
    server: { deps: { inline: ["better-auth"] } },
    projects: [
      {
        extends: true,
        test: {
          name: "unit",
          include: ["tests/**/*.test.ts"],
          exclude: [...configDefaults.exclude, ...DATABASE_BACKED_TEST_FILES],
        },
      },
      {
        extends: true,
        test: {
          name: "database",
          include: DATABASE_BACKED_TEST_FILES,
          fileParallelism: false,
          globalSetup: ["./tests/support/database/global-setup.ts"],
          provide: { testDatabaseUrl: readTestDatabaseUrl() },
        },
      },
    ],
  },
});
