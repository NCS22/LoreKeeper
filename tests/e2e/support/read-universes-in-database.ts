import { withTestDatabaseClient } from "./with-test-database-client";

// What the test database holds about universes, read and edited outside the application, so a test
// can prove that something was stored (or not) and who owns it. Test-only (plan D12).

export type StoredUniverseRow = {
  readonly id: string;
  readonly ownerId: string;
  readonly name: string;
  readonly description: string | null;
  readonly mode: "READER" | "AUTHOR";
  readonly createdAt: Date;
  readonly updatedAt: Date;
};

/** The identifier of the account with this (comparable) email. */
export async function readAccountIdInDatabase(accountEmail: string): Promise<string> {
  return withTestDatabaseClient(async (client) => {
    const result = await client.query<{ id: string }>('SELECT "id" FROM "User" WHERE "email" = $1', [accountEmail]);
    if (result.rows.length !== 1) {
      throw new Error("The account does not exist in the test database.");
    }
    return result.rows[0].id;
  });
}

/** Every universe row of the account (deleted ones included), oldest first and by identifier between equal times. */
export async function readUniversesOfAccountInDatabase(accountEmail: string): Promise<StoredUniverseRow[]> {
  return withTestDatabaseClient(async (client) => {
    const result = await client.query<StoredUniverseRow>(
      `SELECT "id", "ownerId", "name", "description", "mode", "createdAt", "updatedAt"
       FROM "Universe"
       WHERE "ownerId" IN (SELECT "id" FROM "User" WHERE "email" = $1)
       ORDER BY "createdAt", "id"`,
      [accountEmail],
    );
    return result.rows;
  });
}

/** How many universe rows, of any account, have exactly this name: proves a refused or forged call stored nothing. */
export async function countUniversesWithNameInDatabase(universeName: string): Promise<number> {
  return withTestDatabaseClient(async (client) => {
    const result = await client.query<{ total: string }>('SELECT COUNT(*) AS "total" FROM "Universe" WHERE "name" = $1', [
      universeName,
    ]);
    return Number(result.rows[0].total);
  });
}

/** The identifier of the universe remembered for the account, or `null` when none is stored. */
export async function readRememberedUniverseIdInDatabase(accountEmail: string): Promise<string | null> {
  return withTestDatabaseClient(async (client) => {
    const result = await client.query<{ universeId: string }>(
      `SELECT "universeId" FROM "RememberedUniverse"
       WHERE "userId" IN (SELECT "id" FROM "User" WHERE "email" = $1)`,
      [accountEmail],
    );
    return result.rows[0]?.universeId ?? null;
  });
}

/** Stores a universe of the account as its remembered one, as the application would after a selection. */
export async function writeRememberedUniverseInDatabase(accountEmail: string, universeId: string): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    await client.query(
      `INSERT INTO "RememberedUniverse" ("userId", "universeId")
       SELECT "id", $2::uuid FROM "User" WHERE "email" = $1
       ON CONFLICT ("userId") DO UPDATE SET "universeId" = EXCLUDED."universeId"`,
      [accountEmail, universeId],
    );
  });
}

/** Marks a universe as deleted (soft delete), which makes a remembered universe stale. */
export async function markUniverseAsDeletedInDatabase(universeId: string): Promise<void> {
  await withTestDatabaseClient(async (client) => {
    await client.query('UPDATE "Universe" SET "deletedAt" = NOW() WHERE "id" = $1', [universeId]);
  });
}
