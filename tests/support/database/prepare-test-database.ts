import { spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { parseEnv } from "node:util";
import { Client } from "pg";
import { readSafeTestDatabaseName } from "./test-database-guard";

const MAINTENANCE_DATABASE_NAME = "postgres";

/**
 * The test database address, from the shell or from `.env`. The file is read here, as tool
 * configuration, and only this one variable is taken from it.
 */
export function readTestDatabaseUrl(): string | undefined {
  const urlFromShell = process.env.TEST_DATABASE_URL;
  if (urlFromShell) {
    return urlFromShell;
  }
  if (!existsSync(".env")) {
    return undefined;
  }
  return parseEnv(readFileSync(".env", "utf8")).TEST_DATABASE_URL || undefined;
}

/**
 * Prepares the test database: refuses an unsafe address, creates the database if missing and
 * applies the migrations. Shared by the Vitest global setup and the Playwright global setup, so both
 * suites run against the same guarded database.
 */
export async function prepareTestDatabase(testDatabaseUrl: string): Promise<void> {
  const testDatabaseName = readSafeTestDatabaseName(testDatabaseUrl, readDevelopmentDatabaseUrl());
  await createDatabaseIfMissing(testDatabaseUrl, testDatabaseName);
  applyMigrations(testDatabaseUrl);
}

/**
 * The development database address, from the shell or from `.env`. It is used only to refuse a test
 * database that is the same one (the tests empty their tables); it is not handed to any test.
 */
function readDevelopmentDatabaseUrl(): string | undefined {
  const urlFromShell = process.env.DATABASE_URL;
  if (urlFromShell) {
    return urlFromShell;
  }
  if (!existsSync(".env")) {
    return undefined;
  }
  return parseEnv(readFileSync(".env", "utf8")).DATABASE_URL || undefined;
}

async function createDatabaseIfMissing(testDatabaseUrl: string, databaseName: string): Promise<void> {
  const maintenanceUrl = new URL(testDatabaseUrl);
  maintenanceUrl.pathname = `/${MAINTENANCE_DATABASE_NAME}`;
  const client = new Client({ connectionString: maintenanceUrl.toString() });

  try {
    await client.connect();
  } catch {
    throw new Error(
      "cannot connect to PostgreSQL with TEST_DATABASE_URL. Is Docker running? Start the database with `docker compose up -d` and check the values in .env.",
    );
  }

  try {
    const existing = await client.query("SELECT 1 FROM pg_database WHERE datname = $1", [databaseName]);
    if (existing.rowCount === 0) {
      // The name was validated above, so quoting it is enough (identifiers cannot be bound).
      await client.query(`CREATE DATABASE "${databaseName}"`);
    }
  } finally {
    await client.end();
  }
}

function applyMigrations(testDatabaseUrl: string): void {
  const prismaCommandLine = resolve(process.cwd(), "node_modules/prisma/build/index.js");
  const outcome = spawnSync(process.execPath, [prismaCommandLine, "migrate", "deploy"], {
    // prisma.config.ts never overrides a variable that is already set, so this reaches the test database.
    env: { ...process.env, DATABASE_URL: testDatabaseUrl },
    encoding: "utf8",
  });
  if (outcome.status !== 0) {
    // Prisma's output is not included: it can print the host and the database name. A fixed message
    // keeps the console and the failing tests free of connection details.
    throw new Error(
      `applying the migrations failed (exit status ${outcome.status ?? "none"}). To see the output, run \`pnpm prisma migrate deploy\` by hand with DATABASE_URL set to the value of TEST_DATABASE_URL.`,
    );
  }
}
