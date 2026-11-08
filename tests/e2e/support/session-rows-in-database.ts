import { withTestDatabaseClient } from "./with-test-database-client";

// Edits of the stored sessions of one account, made straight in the test database. They stand for
// things that happen outside the browser: a session removed by another device or by a clean-up, and
// a session that ran out of time. Test-only; the application has no knowledge of them (plan D10).

/** Removes every stored session of the account with this (comparable) email. */
export async function deleteSessionRowsInDatabase(email: string): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    await client.query('DELETE FROM "Session" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = $1)', [email]);
  });
}

/** Moves the end of every stored session of the account one day into the past, so the engine reads it as expired. */
export async function expireSessionRowsInDatabase(email: string): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    await client.query(
      `UPDATE "Session" SET "expiresAt" = NOW() - INTERVAL '1 day'
       WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = $1)`,
      [email],
    );
  });
}
