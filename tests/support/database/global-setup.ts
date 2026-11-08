import type { TestProject } from "vitest/node";
import "./provided-context";
import { prepareTestDatabase } from "./prepare-test-database";

/**
 * Prepares the test database once per run: creates it if missing and applies the migrations.
 * A failure does not abort the whole run: it is handed to the database-backed tests, which fail
 * with this message, while the tests that need no database still run. Nothing is ever skipped.
 */
export default async function prepareTestDatabaseForVitest(project: TestProject): Promise<void> {
  try {
    const { testDatabaseUrl } = project.getProvidedContext();
    if (!testDatabaseUrl) {
      throw new Error(
        "TEST_DATABASE_URL is not set. Copy .env.example to .env and fill it in (see specs/002-accounts/tasks.md, 'Before T1').",
      );
    }
    await prepareTestDatabase(testDatabaseUrl);
  } catch (failure) {
    const reason = failure instanceof Error ? failure.message : String(failure);
    project.provide("testDatabaseSetupError", `Test database is not ready: ${reason}`);
  }
}
