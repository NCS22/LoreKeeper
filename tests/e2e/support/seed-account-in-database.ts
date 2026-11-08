import { hashPasswordAsTyped } from "../../../src/shared/infrastructure/scrypt-password-hasher";
import { buildUniqueAccount, type E2eAccount } from "./unique-account";
import { withTestDatabaseClient } from "./with-test-database-client";

/**
 * Creates an account directly in the test database, as the application's sign-up would store it:
 * a user row and a credential row whose password is hashed with the application's own scrypt
 * hasher. It does not go through the browser, so a test that is not about sign-up starts quickly.
 * The email must already be in comparable form (trimmed, lower case); the database enforces it.
 */
export async function seedAccountInDatabase(
  account: E2eAccount = buildUniqueAccount(),
): Promise<E2eAccount> {
  const passwordHash = await hashPasswordAsTyped(account.password);
  await withTestDatabaseClient(async (client) => {
    const insertedUser = await client.query<{ id: string }>(
      'INSERT INTO "User" ("name", "email") VALUES ($1, $2) RETURNING "id"',
      [account.displayName, account.email],
    );
    const userId = insertedUser.rows[0].id;
    // Better Auth stores the credential of an email-and-password account with the user id as account id.
    await client.query(
      'INSERT INTO "Account" ("accountId", "providerId", "userId", "password") VALUES ($1, $2, $3, $4)',
      [userId, "credential", userId, passwordHash],
    );
  });
  return account;
}
