import { expect, test } from "@playwright/test";
import { verifyPasswordAsTyped } from "../../src/shared/infrastructure/scrypt-password-hasher";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { withTestDatabaseClient } from "./support/with-test-database-client";

const UNREACHABLE_DATA_SERVER_ADDRESS = "http://localhost:3101";
const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";

test.describe("harness smoke test", () => {
  test("the workspace root answers on the healthy server with its sample content", async ({ page }) => {
    const response = await page.goto("/");

    expect(response?.status()).toBe(200);
    await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
  });

  test("the workspace root also answers on the unreachable-data server (the guard does not exist yet)", async ({
    request,
  }) => {
    const response = await request.get(`${UNREACHABLE_DATA_SERVER_ADDRESS}/`);

    expect(response.status()).toBe(200);
    expect(await response.text()).toContain(SAMPLE_UNIVERSE_NAME);
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
