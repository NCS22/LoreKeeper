import { prepareTestDatabase, readTestDatabaseUrl } from "../../support/database/prepare-test-database";
import { dropLeftoverStorageFailuresInDatabase } from "./provoke-storage-failure";
import { withTestDatabaseClient } from "./with-test-database-client";

/**
 * Runs once before the end-to-end tests: prepares the test database (refusing an unsafe address,
 * creating it if missing, applying the migrations) and empties the authentication tables.
 * Deleting every user cascades to its sessions and accounts.
 */
export default async function prepareEndToEndDatabase(): Promise<void> {
  const testDatabaseUrl = readTestDatabaseUrl();
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is not set.");
  }
  await prepareTestDatabase(testDatabaseUrl);
  // A trigger that provokes a storage failure, left by a test that did not finish, would break later runs.
  await dropLeftoverStorageFailuresInDatabase();
  await withTestDatabaseClient(async (client) => {
    await client.query('DELETE FROM "Verification"');
    // Deleting every user cascades to its sessions, accounts, universes and remembered universes.
    await client.query('DELETE FROM "User"');
  });
}
