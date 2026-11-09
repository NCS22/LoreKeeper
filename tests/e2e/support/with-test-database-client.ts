import { Client } from "pg";
import { readSafeTestDatabaseName } from "../../support/database/test-database-guard";
import { readTestDatabaseUrl } from "../../support/database/prepare-test-database";

/**
 * Runs `work` with a `pg` client connected to the test database, then disconnects. The address is
 * checked with the same guard as every other test helper before connecting, so these helpers cannot
 * touch a database that is not a test database.
 */
export async function withTestDatabaseClient<Result>(
  work: (client: Client) => Promise<Result>,
): Promise<Result> {
  const testDatabaseUrl = readTestDatabaseUrl();
  if (!testDatabaseUrl) {
    throw new Error("TEST_DATABASE_URL is not set.");
  }
  readSafeTestDatabaseName(testDatabaseUrl);

  const client = new Client({ connectionString: testDatabaseUrl });
  await client.connect();
  try {
    return await work(client);
  } finally {
    await client.end();
  }
}
