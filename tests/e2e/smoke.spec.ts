import { expect, test } from "@playwright/test";
import { en } from "../../src/messages/en";
import { verifyPasswordAsTyped } from "../../src/shared/infrastructure/scrypt-password-hasher";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { withTestDatabaseClient } from "./support/with-test-database-client";

const UNREACHABLE_DATA_SERVER_ADDRESS = "http://localhost:3101";
const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";

test.describe("harness smoke test", () => {
  test("the healthy server sends a signed-out browser asking for the workspace root to the sign-in page", async ({
    page,
  }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    expect(page.url()).toBe("http://localhost:3100/sign-in?returnTo=%2F");
    await expect(page.getByRole("heading", { name: en.accountForms.signIn.title })).toBeVisible();
    await expect(page.getByText(SAMPLE_UNIVERSE_NAME)).toHaveCount(0);
  });

  test("the workspace root redirects a signed-out client to sign-in on the unreachable-data server too (the guard needs no data without a cookie)", async ({
    request,
  }) => {
    const response = await request.get(`${UNREACHABLE_DATA_SERVER_ADDRESS}/`, { maxRedirects: 0 });

    expect(response.status()).toBe(303);
    expect(response.headers()["location"]).toBe("/sign-in?returnTo=%2F");
    expect(await response.text()).not.toContain(SAMPLE_UNIVERSE_NAME);
  });

  test("a seeded account is stored with a credential the application's hasher verifies", async () => {
    const account = await seedAccountInDatabase();

    const storedCredential = await withTestDatabaseClient(async (client) => {
      const result = await client.query<{ password: string; providerId: string }>(
        `SELECT a."password", a."providerId" FROM "Account" a
           JOIN "User" u ON u."id" = a."userId"
          WHERE u."email" = $1`,
        [account.email],
      );
      return result.rows[0];
    });

    expect(storedCredential.providerId).toBe("credential");
    expect(
      await verifyPasswordAsTyped({ hash: storedCredential.password, password: account.password }),
    ).toBe(true);
    expect(
      await verifyPasswordAsTyped({ hash: storedCredential.password, password: "not the password" }),
    ).toBe(false);
  });
});
