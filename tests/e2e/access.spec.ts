import { expect as baseExpect, test } from "@playwright/test";
import { en } from "../../src/messages/en";
import { findSessionCookieValue } from "./support/account-form-support";
import { seedAccountInDatabase } from "./support/seed-account-in-database";
import { waitForFormHydration } from "./support/wait-for-form-hydration";

// Access to pages (FR-15, FR-18, FR-21, FR-22, FR-24, NFR-4). First version, written with the guard:
// the redirect and the refusal of an operation call for a signed-out client, and the way in with a
// real sign-in. The rest of the access specification is added by the task that follows.

// Sign-in runs a deliberately slow password hash, and tests run in parallel.
const expect = baseExpect.configure({ timeout: 15_000 });

const SAMPLE_UNIVERSE_NAME = "The Ember Concordat";
// A call to a Server Action carries this header; its value is the identifier of an action.
const OPERATION_CALL_HEADERS = { "next-action": "0123456789abcdef", "content-type": "text/plain;charset=UTF-8" };

test.describe("a signed-out client", () => {
  test("is redirected from the workspace root to sign-in with 303, carrying the destination, with no workspace text", async ({
    request,
  }) => {
    const response = await request.get("/", { maxRedirects: 0 });

    expect(response.status()).toBe(303);
    expect(new URL(response.headers()["location"], "http://localhost:3100").pathname).toBe("/sign-in");
    expect(response.headers()["location"]).toBe("/sign-in?returnTo=%2F");
    expect(response.headers()["cache-control"]).toBe("no-store");
    // The framework itself ends a redirect from the proxy with the address as the body: only the
    // address to go to, which is not workspace content (NFR-4).
    expect(await response.text()).toBe("/sign-in?returnTo=%2F");
    expect(JSON.stringify(response.headers())).not.toContain(SAMPLE_UNIVERSE_NAME);
    expect(response.headers()["set-cookie"]).toBeUndefined();
  });

  test("gets the 401 text, not a redirect, for an operation call forged to the workspace root", async ({
    request,
  }) => {
    const response = await request.post("/", { headers: OPERATION_CALL_HEADERS, data: "[]", maxRedirects: 0 });

    expect(response.status()).toBe(401);
    expect(response.headers()["location"]).toBeUndefined();
    expect(response.headers()["content-type"]).toBe("text/plain");
    expect(response.headers()["cache-control"]).toBe("no-store");
    const responseText = await response.text();
    expect(responseText).toBe("Signed out.");
    expect(responseText).not.toContain(SAMPLE_UNIVERSE_NAME);
    expect(JSON.stringify(response.headers())).not.toContain(SAMPLE_UNIVERSE_NAME);
  });

  test("sees the sign-in page", async ({ page }) => {
    const response = await page.goto("/sign-in");

    expect(response?.status()).toBe(200);
    await expect(page.getByRole("heading", { name: en.accountForms.signIn.title })).toBeVisible();
  });
});

test("a person who signs in through the page opens the workspace, which proves the session cookie travels", async ({
  page,
}) => {
  const account = await seedAccountInDatabase();
  await page.goto("/sign-in");
  await waitForFormHydration(page);
  await page.getByLabel(en.accountForms.signIn.emailLabel).fill(account.email);
  await page.getByLabel(en.accountForms.signIn.passwordLabel).fill(account.password);
  await page.getByRole("button", { name: en.accountForms.signIn.submit, exact: true }).click();

  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
  expect(await findSessionCookieValue(page)).toBeDefined();

  const reloadedResponse = await page.goto("/");
  expect(reloadedResponse?.status()).toBe(200);
  await expect(page.getByText(SAMPLE_UNIVERSE_NAME).first()).toBeVisible();
});
