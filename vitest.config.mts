import { existsSync, readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { parseEnv } from "node:util";
import { configDefaults, defineConfig } from "vitest/config";

// Test files that talk to PostgreSQL. They share one test database, so they run one file at a time.
// A new database-backed test goes in one of these folders.
const DATABASE_BACKED_TEST_FILES = [
  "tests/shared/infrastructure/**/*.test.ts",
  "tests/modules/*/infrastructure/**/*.test.ts",
  // The use case scenarios of the universes also run against PostgreSQL (spec 004, NFR-1).
  "tests/modules/universes/application/**/*.test.ts",
  // The use case scenarios of the knowledge module also run against PostgreSQL (spec 006, NFR-1).
  "tests/modules/knowledge/application/**/*.test.ts",
  "tests/app/**/*.test.ts",
  // The page loader of the workspace reads the session and the stored universes.
  "tests/components/workspace/load-workspace-universes-for-page.test.ts",
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
    // Coverage is off unless `--coverage` is passed (`pnpm test:coverage`), so `pnpm test` is
    // unchanged. Every source file is included, so a file no test imports shows up at 0 %. The
    // script runs one project at a time and gives each its own `reportsDirectory`, so the report
    // can tell which test type covered what (spec 005a, plan 2.2). No `thresholds` key here: the
    // coverage targets are enforced per inventory entry by that report script, which fails
    // `pnpm test:coverage` only (spec 005b, plan 7.4); `pnpm test` never fails on coverage.
    coverage: {
      provider: "v8",
      include: ["src/**/*.{ts,tsx}"],
      exclude: ["src/shared/infrastructure/generated/**", "**/*.d.ts"],
      reporter: ["json"],
    },
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
      // Component tests render React in a simulated browser document. The `.test.tsx` extension
      // selects them, so the other projects keep the Node environment (spec 005a, D9). While the
      // project has no files, only its step in `test:coverage` passes `--passWithNoTests` (the
      // option is root-only in Vitest), so an empty `unit` or `database` run still fails.
      {
        extends: true,
        test: {
          name: "component",
          include: ["tests/**/*.test.tsx"],
          environment: "jsdom",
        },
      },
    ],
  },
});
