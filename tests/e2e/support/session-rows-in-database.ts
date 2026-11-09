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

/** How much stored time to move back: whole days plus minutes. */
export type SimulatedElapsedTime = { readonly days: number; readonly minutes?: number };

/** "A day without use" for the renewal rule: one day plus one minute, so the once-a-day threshold is certainly passed (plan D10). */
export const ONE_DAY_WITHOUT_USE: SimulatedElapsedTime = { days: 1, minutes: 1 };

/** "Absent for more than 30 days": 31 days. */
export const THIRTY_ONE_DAYS_WITHOUT_USE: SimulatedElapsedTime = { days: 31 };

/**
 * Simulates the passage of time for the account's stored sessions: moves `expiresAt` and `updatedAt`
 * back by `elapsedTime`, which is what real time would do to the values the engine compares with its
 * clock. The browser's own clock and the server's clock do not move (plan D10, D11).
 */
export async function moveSessionRowsBackInTimeInDatabase(
  email: string,
  elapsedTime: SimulatedElapsedTime,
): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    await client.query(
      `UPDATE "Session"
       SET "expiresAt" = "expiresAt" - make_interval(days => $2::int, mins => $3::int),
           "updatedAt" = "updatedAt" - make_interval(days => $2::int, mins => $3::int)
       WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = $1)`,
      [email, elapsedTime.days, elapsedTime.minutes ?? 0],
    );
  });
}

/** The stored end (`expiresAt`) of every session of the account, to show the server renewed it. */
export async function readSessionExpiryDatesInDatabase(email: string): Promise<Date[]> {
  return withTestDatabaseClient(async (client) => {
    const result = await client.query<{ expiresAt: Date }>(
      `SELECT "expiresAt" FROM "Session" WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = $1)`,
      [email],
    );
    return result.rows.map((row) => row.expiresAt);
  });
}
